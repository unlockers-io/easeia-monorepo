import { AiNotConfiguredError } from "@repo/ai";
import type { PostCreateInput } from "@repo/api-types";
import { JobKind, Niche, type Post, PostStatus, prisma, type SiteLanguage } from "@repo/db";
import { closeJobs, countJobs, listJobs } from "@repo/jobs";
import { SiteDeployHookMissingError } from "@repo/sites";
import { afterAll, afterEach, describe, expect, it } from "vitest";

import * as Posts from "./index";
import { PostNotFoundError, PostStateError, PostValidationError } from "./index";

const HOOK = "https://deploy.test/hook";

const postJobs = (kind: JobKind, postId: string) => countJobs({ kinds: [kind], postId });

const deploys = (siteId: string) => countJobs({ kinds: [JobKind.TRIGGER_DEPLOY], siteId });

const load = (id: string) => prisma.post.findUniqueOrThrow({ where: { id } });

const latestDeploy = async (siteId: string) => {
  const { data } = await listJobs({ kinds: [JobKind.TRIGGER_DEPLOY], limit: 1, siteId });

  return data[0];
};

const bodyOf = async (id: string) => {
  const post = await load(id);

  return post.body;
};

const statusOf = async (id: string) => {
  const post = await load(id);

  return post.status;
};

describe.runIf(process.env.TEST_DATABASE === "true" && process.env.TEST_REDIS === "true")(
  "Post intake",
  () => {
    const run = `posts-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const siteIds: Array<string> = [];
    let sequence = 0;

    const createSite = async (
      vercelDeployHookUrl: string | null = HOOK,
      language: SiteLanguage = "PT",
    ): Promise<string> => {
      sequence += 1;

      const site = await prisma.site.create({
        data: { domain: `s${sequence}.${run}.test`, language, vercelDeployHookUrl },
      });

      siteIds.push(site.id);

      return site.id;
    };

    const createDraft = async (siteId: string, patch: Partial<PostCreateInput> = {}) => {
      sequence += 1;

      const { post } = await Posts.create({
        body: "<p>Body.</p>",
        categories: ["Casamentos"],
        niches: [Niche.WEDDING],
        siteId,
        slug: `post-${sequence}`,
        tags: ["noivas"],
        title: `Post ${sequence}`,
        ...patch,
      });

      return post;
    };

    const createLive = async (siteId: string): Promise<Post> => {
      const draft = await createDraft(siteId);

      return prisma.post.update({
        data: { publishedAt: new Date(), status: PostStatus.PUBLISHED },
        where: { id: draft.id },
      });
    };

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

    describe("create", () => {
      it("stores a draft and sets nothing off", async () => {
        const siteId = await createSite();
        const post = await createDraft(siteId);

        expect(post.status).toBe(PostStatus.DRAFT);
        expect(await postJobs(JobKind.PUBLISH, post.id)).toBe(0);
        expect(await deploys(siteId)).toBe(0);
      });

      it("claims a post created with publish and enqueues one PUBLISH Job", async () => {
        const siteId = await createSite();
        const post = await createDraft(siteId, { publish: true });

        expect(await statusOf(post.id)).toBe(PostStatus.SCHEDULED);
        expect(await postJobs(JobKind.PUBLISH, post.id)).toBe(1);
      });

      it("writes nothing when publishing to a Site without a deploy hook", async () => {
        const siteId = await createSite(null);

        await expect(createDraft(siteId, { publish: true })).rejects.toBeInstanceOf(
          SiteDeployHookMissingError,
        );
        expect(await prisma.post.count({ where: { siteId } })).toBe(0);
      });
    });

    describe("update", () => {
      it("keeps the arrays a partial update does not mention", async () => {
        const siteId = await createSite();
        const post = await createDraft(siteId);

        const updated = await Posts.update(post.id, { title: "Renamed" });

        expect(updated.title).toBe("Renamed");
        expect(updated.tags).toEqual(["noivas"]);
        expect(updated.categories).toEqual(["Casamentos"]);
        expect(updated.niches).toEqual([Niche.WEDDING]);
      });

      it("never moves a post to another Site", async () => {
        const siteId = await createSite();
        const otherSiteId = await createSite();
        const post = await createDraft(siteId);

        const patch = { siteId: otherSiteId, title: "Stays" };
        const updated = await Posts.update(post.id, patch);

        expect(updated.siteId).toBe(siteId);
      });

      it("rejects invalid fields", async () => {
        const siteId = await createSite();
        const post = await createDraft(siteId);

        await expect(Posts.update(post.id, { slug: "Not Kebab" })).rejects.toBeInstanceOf(
          PostValidationError,
        );
      });

      it("re-embeds, re-crawls and redeploys when a live post's content changes", async () => {
        const siteId = await createSite();
        const post = await createLive(siteId);

        await Posts.update(post.id, { body: "<p>New body.</p>" });

        expect(await deploys(siteId)).toBe(1);
        expect(await postJobs(JobKind.EMBED, post.id)).toBe(1);
        expect(await postJobs(JobKind.CRAWL_LINKS, post.id)).toBe(1);
      });

      it("only redeploys when a live post changes without new content", async () => {
        const siteId = await createSite();
        const post = await createLive(siteId);

        await Posts.update(post.id, { tags: ["casamento"] });

        expect(await deploys(siteId)).toBe(1);
        expect(await postJobs(JobKind.EMBED, post.id)).toBe(0);
      });

      it("sets nothing off for a draft", async () => {
        const siteId = await createSite();
        const post = await createDraft(siteId);

        await Posts.update(post.id, { body: "<p>New body.</p>" });

        expect(await deploys(siteId)).toBe(0);
        expect(await postJobs(JobKind.EMBED, post.id)).toBe(0);
      });

      it("reports a missing post", async () => {
        await expect(Posts.update("missing", { title: "x" })).rejects.toBeInstanceOf(
          PostNotFoundError,
        );
      });
    });

    describe("publish", () => {
      it("lets one of two concurrent publishes win", async () => {
        const siteId = await createSite();
        const post = await createDraft(siteId);

        const results = await Promise.allSettled([Posts.publish(post.id), Posts.publish(post.id)]);

        expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
        expect(results.find((r) => r.status === "rejected")?.reason).toBeInstanceOf(PostStateError);
        expect(await postJobs(JobKind.PUBLISH, post.id)).toBe(1);
      });

      it("refuses a post whose publish is already queued", async () => {
        const siteId = await createSite();
        const post = await createDraft(siteId);
        await Posts.publish(post.id);

        await expect(Posts.publish(post.id)).rejects.toBeInstanceOf(PostStateError);
        expect(await postJobs(JobKind.PUBLISH, post.id)).toBe(1);
      });

      it("republishes a live post", async () => {
        const siteId = await createSite();
        const post = await createLive(siteId);

        const { post: claimed } = await Posts.publish(post.id);

        expect(claimed.status).toBe(PostStatus.SCHEDULED);
        expect(await postJobs(JobKind.PUBLISH, post.id)).toBe(1);
      });
    });

    describe("publish completion", () => {
      it("marks the post PUBLISHED, then redeploys its Site, then fans out", async () => {
        const siteId = await createSite();
        const post = await createDraft(siteId);
        await Posts.publish(post.id);

        expect(await Posts.startPublish(post.id)).not.toBeNull();
        await Posts.completePublish(post.id, { bodyImages: false });

        const published = await load(post.id);
        const deploy = await latestDeploy(siteId);
        expect(published.status).toBe(PostStatus.PUBLISHED);
        expect(deploy?.createdAt.getTime()).toBeGreaterThanOrEqual(
          published.publishedAt?.getTime() ?? Number.POSITIVE_INFINITY,
        );
        expect(await postJobs(JobKind.EMBED, post.id)).toBe(1);
        expect(await postJobs(JobKind.CRAWL_LINKS, post.id)).toBe(1);
        expect(await postJobs(JobKind.GENERATE_BODY_IMAGES, post.id)).toBe(0);
      });

      it("illustrates the body when body images are enabled", async () => {
        const siteId = await createSite();
        const post = await createDraft(siteId);
        await Posts.publish(post.id);

        await Posts.completePublish(post.id, { bodyImages: true });

        expect(await postJobs(JobKind.GENERATE_BODY_IMAGES, post.id)).toBe(1);
      });

      it("gives an uncategorized post the Site's prevailing category for its niches", async () => {
        const siteId = await createSite();
        await createDraft(siteId, { categories: ["Eventos"], niches: [Niche.EVENTS] });
        await createDraft(siteId, { categories: ["Casamentos"], niches: [Niche.WEDDING] });
        await createDraft(siteId, { categories: ["Eventos"], niches: [Niche.EVENTS] });
        const post = await createDraft(siteId, { categories: [], niches: [Niche.WEDDING] });
        await Posts.publish(post.id);

        const started = await Posts.startPublish(post.id);

        expect(started?.post.categories).toEqual(["Casamentos"]);
        const stored = await load(post.id);
        expect(stored.categories).toEqual(["Casamentos"]);
      });

      it("falls back to the niche name on a Site without categories", async () => {
        const siteId = await createSite();
        const post = await createDraft(siteId, { categories: [], niches: [Niche.FILM] });
        await Posts.publish(post.id);

        const started = await Posts.startPublish(post.id);

        expect(started?.post.categories).toEqual(["Cinema"]);
      });

      it("does not resurrect a post archived while its publish was queued", async () => {
        const siteId = await createSite();
        const post = await createDraft(siteId);
        await Posts.publish(post.id);
        await Posts.unpublish(post.id);

        expect(await Posts.startPublish(post.id)).toBeNull();
        await Posts.completePublish(post.id, { bodyImages: false });

        expect(await statusOf(post.id)).toBe(PostStatus.ARCHIVED);
        expect(await deploys(siteId)).toBe(0);
      });

      it("fails a queued publish but leaves an archived post alone", async () => {
        const siteId = await createSite();
        const queued = await createDraft(siteId);
        const archived = await createDraft(siteId);
        await Posts.publish(queued.id);
        await Posts.publish(archived.id);
        await Posts.unpublish(archived.id);

        await Posts.failPublish(queued.id);
        await Posts.failPublish(archived.id);

        expect(await statusOf(queued.id)).toBe(PostStatus.FAILED);
        expect(await statusOf(archived.id)).toBe(PostStatus.ARCHIVED);
      });
    });

    describe("unpublish and remove", () => {
      it("redeploys the Site when unpublishing a live post", async () => {
        const siteId = await createSite();
        const post = await createLive(siteId);

        const { post: archived } = await Posts.unpublish(post.id);

        expect(archived.status).toBe(PostStatus.ARCHIVED);
        expect(await deploys(siteId)).toBe(1);
      });

      it("redeploys the Site when removing a live post", async () => {
        const siteId = await createSite();
        const post = await createLive(siteId);

        await Posts.remove(post.id);

        expect(await prisma.post.count({ where: { id: post.id } })).toBe(0);
        expect(await deploys(siteId)).toBe(1);
      });

      it("redeploys nothing for a post that never went live", async () => {
        const siteId = await createSite();
        const archived = await createDraft(siteId);
        const removed = await createDraft(siteId);

        await Posts.unpublish(archived.id);
        await Posts.remove(removed.id);

        expect(await deploys(siteId)).toBe(0);
      });
    });

    describe("rewrite", () => {
      it("requires AI", async () => {
        const siteId = await createSite();
        const post = await createDraft(siteId);

        await expect(Posts.requestRewrite(post.id, { force: true })).rejects.toBeInstanceOf(
          AiNotConfiguredError,
        );
        expect(await postJobs(JobKind.REWRITE_POST, post.id)).toBe(0);
      });

      it("requires a publishable Site", async () => {
        process.env.OPENAI_API_KEY = "sk-test";
        const siteId = await createSite(null);
        const post = await createDraft(siteId);

        await expect(Posts.requestRewrite(post.id, { force: true })).rejects.toBeInstanceOf(
          SiteDeployHookMissingError,
        );
      });

      it("reports a missing post", async () => {
        process.env.OPENAI_API_KEY = "sk-test";

        await expect(Posts.requestRewrite("missing", { force: false })).rejects.toBeInstanceOf(
          PostNotFoundError,
        );
      });

      it("enqueues one REWRITE_POST Job", async () => {
        process.env.OPENAI_API_KEY = "sk-test";
        const siteId = await createSite();
        const post = await createDraft(siteId);

        await Posts.requestRewrite(post.id, { force: true });

        expect(await postJobs(JobKind.REWRITE_POST, post.id)).toBe(1);
      });
    });

    describe("body", () => {
      const EM = "\u2014";

      const paragraph =
        "Um parágrafo longo o bastante para contar como bloco substancial na análise do corpo.";

      it("stores a normalized body from create, update and revise", async () => {
        const siteId = await createSite();
        const created = await createDraft(siteId, { body: "<h2>Título</h2><p>Corpo\u0011.</p>" });

        const updated = await Posts.update(created.id, {
          body: "<!-- wp:paragraph -->\n<p>Veja [o guia](https://x.test/guia).</p>\n<!-- /wp:paragraph -->",
        });

        const revised = await Posts.reviseBody(created.id, {
          body: [paragraph, paragraph, paragraph].join("\n\n"),
          from: updated.body,
        });

        expect(created.body).toBe("## Título\n\nCorpo.");
        expect(updated.body).toBe("Veja [o guia](https://x.test/guia).");
        expect(revised.body).toBe(paragraph);
        expect(await bodyOf(created.id)).toBe(paragraph);
      });

      it("applies the Portuguese clause rules to PT bodies only", async () => {
        const body = `A luz estava dura ${EM} mudamos a sessao para dentro.`;
        const pt = await createDraft(await createSite(HOOK, "PT"), { body });

        const en = await createDraft(await createSite(HOOK, "EN"), {
          body: `The light was harsh ${EM} we moved the shoot indoors.`,
        });

        expect(pt.body).toBe("A luz estava dura: mudamos a sessao para dentro.");
        expect(en.body).toBe("The light was harsh, we moved the shoot indoors.");
      });

      it("writes the rewrite fields with the body", async () => {
        const siteId = await createSite();
        const post = await createDraft(siteId);
        const rewrittenAt = new Date();

        const revised = await Posts.reviseBody(post.id, {
          body: "Novo corpo.",
          excerpt: "Novo resumo.",
          focusKeyword: "novo",
          from: post.body,
          rewrittenAt,
          title: "Novo título",
        });

        expect(revised).toMatchObject({
          body: "Novo corpo.",
          excerpt: "Novo resumo.",
          focusKeyword: "novo",
          rewrittenAt,
          title: "Novo título",
        });
      });

      it("keeps one of two concurrent revisions of the same body and refuses the other", async () => {
        const siteId = await createSite();
        const post = await createDraft(siteId);

        const results = await Promise.allSettled([
          Posts.reviseBody(post.id, { body: "Primeira.", from: post.body }),
          Posts.reviseBody(post.id, { body: "Segunda.", from: post.body }),
        ]);

        const kept = results.flatMap((r) => (r.status === "fulfilled" ? [r.value.body] : []));
        expect(kept).toHaveLength(1);
        expect(results.find((r) => r.status === "rejected")?.reason).toBeInstanceOf(PostStateError);
        expect(await bodyOf(post.id)).toBe(kept[0]);
      });

      it("refuses a revision of a body that changed since it was read", async () => {
        const siteId = await createSite();
        const post = await createDraft(siteId);
        await Posts.update(post.id, { body: "Editado no painel." });

        await expect(
          Posts.reviseBody(post.id, { body: "Revisão antiga.", from: post.body }),
        ).rejects.toBeInstanceOf(PostStateError);
        expect(await bodyOf(post.id)).toBe("Editado no painel.");
      });

      it("re-embeds, re-crawls and redeploys when a live post's body is revised", async () => {
        const siteId = await createSite();
        const post = await createLive(siteId);

        await Posts.reviseBody(post.id, { body: "Corpo revisado.", from: post.body });

        expect(await deploys(siteId)).toBe(1);
        expect(await postJobs(JobKind.EMBED, post.id)).toBe(1);
        expect(await postJobs(JobKind.CRAWL_LINKS, post.id)).toBe(1);
      });
    });

    describe("bucket drafts", () => {
      it("publishes only drafts", async () => {
        const siteId = await createSite();
        const draft = await createDraft(siteId);
        const live = await createLive(siteId);

        await expect(Posts.publishBucketDraft(live.id)).rejects.toBeInstanceOf(PostStateError);
        await Posts.publishBucketDraft(draft.id);

        expect(await statusOf(draft.id)).toBe(PostStatus.SCHEDULED);
        expect(await postJobs(JobKind.PUBLISH, draft.id)).toBe(1);
        expect(await postJobs(JobKind.PUBLISH, live.id)).toBe(0);
      });

      it("removes only drafts", async () => {
        const siteId = await createSite();
        const draft = await createDraft(siteId);
        const live = await createLive(siteId);

        await expect(Posts.removeBucketDraft(live.id)).rejects.toBeInstanceOf(PostStateError);
        await Posts.removeBucketDraft(draft.id);

        expect(await prisma.post.count({ where: { id: draft.id } })).toBe(0);
        expect(await prisma.post.count({ where: { id: live.id } })).toBe(1);
      });
    });

    describe("list", () => {
      it("filters by any of several niches, title or slug, oldest first", async () => {
        const siteId = await createSite();
        const wedding = await createDraft(siteId, { niches: [Niche.WEDDING], slug: "alpha-noiva" });
        const film = await createDraft(siteId, { niches: [Niche.FILM], title: "Alpha cinema" });
        await createDraft(siteId, { niches: [Niche.FOOD], title: "Alpha comida" });

        const { data } = await Posts.list({
          niche: [Niche.WEDDING, Niche.FILM],
          q: "alpha",
          siteId,
          sort: "oldest",
        });

        expect(data.map((p) => p.id)).toEqual([wedding.id, film.id]);
      });
    });
  },
);
