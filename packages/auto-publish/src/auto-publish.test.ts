import { AiNotConfiguredError } from "@repo/ai";
import { JobKind, Niche, type Prisma, PostStatus, prisma } from "@repo/db";
import { closeJobs, countJobs, enqueue } from "@repo/jobs";
import * as Posts from "@repo/posts";
import { PostStateError } from "@repo/posts";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";

import * as AutoPublish from "./index";
import { AutoPublishConfigError } from "./index";

const HOOK = "https://deploy.test/hook";
const DAY_MS = 24 * 60 * 60 * 1000;

const daysAgo = (days: number) => new Date(Date.now() - days * DAY_MS);

const statusOf = async (id: string) => {
  const post = await prisma.post.findUniqueOrThrow({ where: { id } });
  return post.status;
};

const siteRow = (id: string) => prisma.site.findUniqueOrThrow({ where: { id } });

const stampOf = async (id: string) => {
  const site = await siteRow(id);
  return site.lastAutoPublishedAt;
};

const tickFor = async (ids: ReadonlyArray<string>) => {
  const result = await AutoPublish.tick();
  const mine = new Set(ids);
  return {
    published: result.published.filter((entry) => mine.has(entry.siteId)),
    refills: result.refills.filter((entry) => mine.has(entry.siteId)),
    skipped: result.skipped.filter((entry) => mine.has(entry.siteId)),
  };
};

const generating = (siteId: string) => countJobs({ kinds: [JobKind.GENERATE_POST], siteId });

const publishJobs = (postId: string) => countJobs({ kinds: [JobKind.PUBLISH], postId });

describe.runIf(process.env.TEST_DATABASE === "true" && process.env.TEST_REDIS === "true")(
  "Auto-publish",
  () => {
    const run = `auto-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const siteIds: Array<string> = [];
    let sequence = 0;

    const createSite = async (data: Partial<Prisma.SiteCreateInput> = {}): Promise<string> => {
      sequence += 1;
      const site = await prisma.site.create({
        data: { domain: `s${sequence}.${run}.test`, vercelDeployHookUrl: HOOK, ...data },
      });
      siteIds.push(site.id);
      return site.id;
    };

    const createDraft = async (siteId: string, scheduledAt?: Date) => {
      sequence += 1;
      const { post } = await Posts.create({
        body: "<p>Body.</p>",
        categories: ["Casamentos"],
        niches: [Niche.WEDDING],
        scheduledAt,
        siteId,
        slug: `post-${sequence}`,
        tags: [],
        title: `Post ${sequence}`,
      });
      return post.id;
    };

    beforeEach(() => {
      process.env.OPENAI_API_KEY = "sk-test";
    });

    afterEach(() => {
      delete process.env.OPENAI_API_KEY;
    });

    afterAll(async () => {
      await prisma.job.deleteMany({
        where: { OR: [{ siteId: { in: siteIds } }, { post: { siteId: { in: siteIds } } }] },
      });
      await prisma.site.deleteMany({ where: { id: { in: siteIds } } });
      await closeJobs();
    });

    describe("due rule", () => {
      it("publishes the oldest bucket draft of each due Site once per cadence", async () => {
        const never = await createSite({ autoPublishEnabled: true, cadenceDays: 3 });
        const neverOldest = await createDraft(never);
        const neverNewer = await createDraft(never);
        const elapsed = await createSite({
          autoPublishEnabled: true,
          cadenceDays: 2,
          lastAutoPublishedAt: daysAgo(3),
        });
        const elapsedDraft = await createDraft(elapsed);
        const recent = await createSite({
          autoPublishEnabled: true,
          cadenceDays: 7,
          lastAutoPublishedAt: daysAgo(1),
        });
        const recentDraft = await createDraft(recent);
        const disabled = await createSite({
          autoPublishEnabled: true,
          cadenceDays: 1,
          isEnabled: false,
        });
        const off = await createSite({ autoPublishEnabled: false, cadenceDays: 1 });
        const empty = await createSite({ autoPublishEnabled: true, cadenceDays: 1 });
        const onlyScheduled = await createSite({ autoPublishEnabled: true, cadenceDays: 1 });
        const scheduledDraft = await createDraft(onlyScheduled, daysAgo(-5));
        const offDraft = await createDraft(off);
        await prisma.post.create({
          data: { body: "", siteId: disabled, slug: `disabled-${run}`, title: "Disabled" },
        });
        const sites = [never, elapsed, recent, disabled, off, empty, onlyScheduled];

        const first = await tickFor(sites);

        expect(first.published).toEqual(
          expect.arrayContaining([
            { postId: neverOldest, siteId: never },
            { postId: elapsedDraft, siteId: elapsed },
          ]),
        );
        expect(first.published).toHaveLength(2);
        expect(first.skipped).toEqual([]);
        expect(await statusOf(neverOldest)).toBe(PostStatus.SCHEDULED);
        expect(await statusOf(neverNewer)).toBe(PostStatus.DRAFT);
        expect(await statusOf(recentDraft)).toBe(PostStatus.DRAFT);
        expect(await statusOf(scheduledDraft)).toBe(PostStatus.DRAFT);
        expect(await statusOf(offDraft)).toBe(PostStatus.DRAFT);
        expect(await stampOf(never)).not.toBeNull();
        const elapsedStamp = await stampOf(elapsed);
        expect(elapsedStamp?.getTime()).toBeGreaterThan(daysAgo(1).getTime());
        expect(await stampOf(empty)).toBeNull();

        const second = await tickFor(sites);
        expect(second.published).toEqual([]);
        expect(await publishJobs(neverOldest)).toBe(1);
        expect(await publishJobs(neverNewer)).toBe(0);
      });

      it("skips a due Site that cannot publish and leaves its cadence clock alone", async () => {
        const siteId = await createSite({
          autoPublishEnabled: true,
          cadenceDays: 1,
          vercelDeployHookUrl: null,
        });
        const draft = await createDraft(siteId);

        const result = await tickFor([siteId]);

        expect(result.published).toEqual([]);
        expect(result.skipped).toEqual([{ reason: expect.stringMatching(/deploy hook/v), siteId }]);
        expect(await statusOf(draft)).toBe(PostStatus.DRAFT);
        expect(await stampOf(siteId)).toBeNull();
      });
    });

    describe("claim", () => {
      it("publishes exactly one draft when claims race", async () => {
        const siteId = await createSite();
        const draft = await createDraft(siteId);

        const outcomes = await Promise.allSettled([
          AutoPublish.publishNext(siteId),
          AutoPublish.publishNext(siteId),
          AutoPublish.publishDraft(draft),
        ]);

        expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
        for (const outcome of outcomes) {
          if (outcome.status === "rejected") {
            expect(outcome.reason).toBeInstanceOf(PostStateError);
          }
        }
        expect(await statusOf(draft)).toBe(PostStatus.SCHEDULED);
        expect(await publishJobs(draft)).toBe(1);
        expect(await stampOf(siteId)).not.toBeNull();
        expect(await AutoPublish.publishNext(siteId)).toBeNull();
      });
    });

    describe("refill", () => {
      it("counts in-flight GENERATE_POST Jobs as supply", async () => {
        const siteId = await createSite({ bucketRefillAt: 3, bucketTarget: 5 });
        await createDraft(siteId);
        await enqueue({ kind: JobKind.GENERATE_POST, payload: { siteId }, siteId });

        const first = await AutoPublish.refill(siteId);

        expect(first).toMatchObject({ queued: 3, supply: { drafts: 1, inflight: 1, total: 2 } });
        expect(await generating(siteId)).toBe(4);
        expect(await AutoPublish.refill(siteId)).toMatchObject({
          queued: 0,
          supply: { drafts: 1, inflight: 4, total: 5 },
        });
      });

      it("caps a tick's refill and skips disabled or unconfigured Sites", async () => {
        const large = await createSite({ bucketRefillAt: 50, bucketTarget: 100 });
        const disabled = await createSite({
          bucketRefillAt: 2,
          bucketTarget: 4,
          isEnabled: false,
        });
        const unconfigured = await createSite();

        const { refills } = await tickFor([large, disabled, unconfigured]);

        expect(refills).toEqual([
          { domain: expect.any(String), queued: 20, siteId: large, supply: expect.any(Object) },
        ]);
        expect(await generating(large)).toBe(20);
        expect(await generating(disabled)).toBe(0);
        expect(await AutoPublish.refill(unconfigured)).toMatchObject({ queued: 0 });
      });

      it("refuses to queue generations without AI", async () => {
        const siteId = await createSite({ bucketRefillAt: 1, bucketTarget: 2 });
        delete process.env.OPENAI_API_KEY;

        await expect(AutoPublish.refill(siteId)).rejects.toBeInstanceOf(AiNotConfiguredError);
        expect(await generating(siteId)).toBe(0);
      });
    });

    describe("buckets", () => {
      it("reads supply, refill need and missed cadence per Site", async () => {
        const missed = await createSite({ autoPublishEnabled: true, cadenceDays: 1 });
        const needy = await createSite({ bucketRefillAt: 2, bucketTarget: 3 });
        const needyDraft = await createDraft(needy);
        await createDraft(needy, daysAgo(-1));

        const buckets = await AutoPublish.readBuckets(new Date());
        const byId = new Map(buckets.map((bucket) => [bucket.id, bucket]));

        expect(byId.get(missed)).toMatchObject({ missedCadence: true, needsRefill: false });
        expect(byId.get(needy)).toMatchObject({
          drafts: [expect.objectContaining({ id: needyDraft })],
          missedCadence: false,
          needsRefill: true,
          supply: { drafts: 1, inflight: 0, total: 1 },
        });
      });
    });

    describe("config", () => {
      it("clamps the cadence and enables auto-publish only with a cadence", async () => {
        const siteId = await createSite({ bucketRefillAt: 2, bucketTarget: 4 });

        await AutoPublish.configure(siteId, { autoPublishEnabled: true, cadenceDays: 900 });
        expect(await siteRow(siteId)).toMatchObject({
          autoPublishEnabled: true,
          bucketRefillAt: 2,
          bucketTarget: 4,
          cadenceDays: 365,
        });

        await AutoPublish.configure(siteId, {
          autoPublishEnabled: false,
          bucket: { refillAt: 0.5, target: 250 },
          cadenceDays: 0,
        });
        expect(await siteRow(siteId)).toMatchObject({
          autoPublishEnabled: false,
          bucketRefillAt: 1,
          bucketTarget: 100,
          cadenceDays: 1,
        });
      });

      it("rejects an invalid schedule without writing it", async () => {
        const siteId = await createSite({ cadenceDays: 7 });
        const rejections = [
          { autoPublishEnabled: true, cadenceDays: null },
          { autoPublishEnabled: false, bucket: { refillAt: 3, target: null }, cadenceDays: 7 },
          { autoPublishEnabled: false, bucket: { refillAt: 6, target: 5 }, cadenceDays: 7 },
        ];

        for (const input of rejections) {
          await expect(AutoPublish.configure(siteId, input)).rejects.toBeInstanceOf(
            AutoPublishConfigError,
          );
        }
        await expect(
          AutoPublish.applyNetworkDefaults({
            bucket: { refillAt: null, target: null },
            cadenceDays: null,
            scope: "unconfigured",
          }),
        ).rejects.toThrow(/at least one section/v);
        await expect(
          AutoPublish.applyNetworkDefaults({
            bucket: { refillAt: 9, target: 4 },
            cadenceDays: 3,
            scope: "overwrite",
          }),
        ).rejects.toThrow(/must be ≤ bucket target/v);
        expect(await siteRow(siteId)).toMatchObject({
          autoPublishEnabled: false,
          bucketRefillAt: null,
          bucketTarget: null,
          cadenceDays: 7,
        });
      });
    });
  },
);
