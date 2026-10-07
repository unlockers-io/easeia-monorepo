import { JobKind, JobStatus, prisma } from "@repo/db";
import { closeJobs, consume, countJobs, listJobs } from "@repo/jobs";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { deploy, requestRedeploy } from "./index";

type PostHook = (hook: URL, init: RequestInit) => Promise<Response>;

const HOOK = "https://deploy.test/hook";

const consumeDeploys = (postHook: PostHook) =>
  consume({
    concurrency: 1,
    handler: async ({ payload }) => {
      await deploy(payload.siteId, postHook);
    },
    kind: JobKind.TRIGGER_DEPLOY,
  });

const deploys = (siteId: string, status?: JobStatus) =>
  countJobs({ kinds: [JobKind.TRIGGER_DEPLOY], siteId, status });

const settled = (siteId: string, count: number, timeout = 5000) =>
  vi.waitFor(
    async () => {
      expect(await deploys(siteId, JobStatus.DONE)).toBe(count);
    },
    { timeout },
  );

const ok = () => Promise.resolve(new Response("ok"));

describe.runIf(process.env.TEST_DATABASE === "true" && process.env.TEST_REDIS === "true")(
  "Sites redeploy",
  () => {
    const run = `redeploy-${Date.now()}`;
    const sites: Record<string, string> = {};

    beforeAll(async () => {
      const fixtures = {
        badHook: { vercelDeployHookUrl: "file:///etc/passwd" },
        coalesce: { vercelDeployHookUrl: HOOK },
        disabled: { isEnabled: false, vercelDeployHookUrl: HOOK },
        noHook: { vercelDeployHookUrl: null },
        retry: { vercelDeployHookUrl: HOOK },
        running: { vercelDeployHookUrl: HOOK },
      };
      for (const [name, data] of Object.entries(fixtures)) {
        const site = await prisma.site.create({ data: { domain: `${name}.${run}.test`, ...data } });
        sites[name] = site.id;
      }
    });

    afterAll(async () => {
      const ids = Object.values(sites);
      await prisma.job.deleteMany({ where: { siteId: { in: ids } } });
      await prisma.site.deleteMany({ where: { id: { in: ids } } });
      await closeJobs();
    });

    it("never deploys a disabled Site", async () => {
      const siteId = sites.disabled ?? "";
      const postHook = vi.fn<PostHook>(ok);

      expect(await requestRedeploy(siteId)).toBe("disabled");
      expect(await deploy(siteId, postHook)).toBe("disabled");
      expect(await deploys(siteId)).toBe(0);
      expect(postHook).not.toHaveBeenCalled();
    });

    it.each(["noHook", "badHook"])("never deploys a Site with %s", async (name) => {
      const siteId = sites[name] ?? "";
      const postHook = vi.fn<PostHook>(ok);

      expect(await requestRedeploy(siteId)).toBe("no-deploy-hook");
      expect(await deploy(siteId, postHook)).toBe("no-deploy-hook");
      expect(await deploys(siteId)).toBe(0);
      expect(postHook).not.toHaveBeenCalled();
    });

    it("coalesces requests made while a deploy is queued into one deploy", async () => {
      const siteId = sites.coalesce ?? "";
      const postHook = vi.fn<PostHook>(ok);

      const outcomes = await Promise.all([1, 2, 3].map(() => requestRedeploy(siteId)));

      expect(outcomes.toSorted()).toEqual(["coalesced", "coalesced", "queued"]);
      expect(await deploys(siteId)).toBe(1);

      const worker = consumeDeploys(postHook);
      await settled(siteId, 1);
      await worker.close();

      expect(postHook).toHaveBeenCalledExactlyOnceWith(new URL(HOOK), expect.anything());
    });

    it("follows a request made while a deploy is running with exactly one more deploy", async () => {
      const siteId = sites.running ?? "";
      const { promise: released, resolve: release } = Promise.withResolvers<undefined>();
      const postHook = vi.fn<PostHook>(async () => {
        if (postHook.mock.calls.length === 1) {
          await released;
        }
        return new Response("ok");
      });
      const worker = consumeDeploys(postHook);

      expect(await requestRedeploy(siteId)).toBe("queued");
      await vi.waitFor(() => {
        expect(postHook).toHaveBeenCalledOnce();
      });
      expect(await deploys(siteId, JobStatus.RUNNING)).toBe(1);

      const duringRun = await Promise.all([requestRedeploy(siteId), requestRedeploy(siteId)]);
      release(undefined);
      await settled(siteId, 2);
      await worker.close();

      expect(duringRun.toSorted()).toEqual(["coalesced", "queued"]);
      expect(await deploys(siteId)).toBe(2);
      expect(postHook).toHaveBeenCalledTimes(2);
    });

    it("retries a deploy whose hook answers non-2xx", { timeout: 30_000 }, async () => {
      const siteId = sites.retry ?? "";
      const postHook = vi
        .fn<PostHook>(ok)
        .mockResolvedValueOnce(new Response("busy", { status: 503 }));
      const worker = consumeDeploys(postHook);

      expect(await requestRedeploy(siteId)).toBe("queued");
      await vi.waitFor(async () => {
        const { data } = await listJobs({ kinds: [JobKind.TRIGGER_DEPLOY], limit: 1, siteId });
        expect(data[0]).toMatchObject({
          attempts: 1,
          lastError: expect.stringContaining("503"),
          status: JobStatus.QUEUED,
        });
      });
      await settled(siteId, 1, 20_000);
      await worker.close();

      expect(postHook).toHaveBeenCalledTimes(2);
    });
  },
);
