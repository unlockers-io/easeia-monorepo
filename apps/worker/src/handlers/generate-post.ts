import { dataForSeo } from "@repo/dataforseo";
import { JobKind, type Prisma, prisma, type SiteLanguage } from "@repo/db";
import { enqueue } from "@repo/jobs";
import { log as workerLog } from "@repo/observability";
import * as Posts from "@repo/posts";
import {
  generateNewPost,
  proposeTopic,
  selectAnchorsForNewPost,
  type SerpCompetitor,
} from "@repo/rewrite";

import { fetchTopSearchQueries } from "../lib/gsc-queries";
import type { JobContext } from "../lib/job-log";

type SiteForGeneration = Pick<
  Prisma.SiteGetPayload<{
    include: { moneySite: { select: { name: true } } };
  }>,
  "domain" | "id" | "isEnabled" | "language" | "moneySite" | "niches" | "topicHints"
>;

type SerpLookup = {
  domain: string;
  keyword: string;
  language: SiteLanguage;
};

type GeneratePostDependencies = {
  createPost: typeof Posts.create;
  enqueueJob: typeof enqueue;
  fetchSearchQueries: (domain: string) => Promise<ReadonlyArray<string>>;
  fetchSerpCompetitors: (input: SerpLookup) => Promise<ReadonlyArray<SerpCompetitor>>;
  findRecentTitles: (siteId: string) => Promise<ReadonlyArray<string>>;
  findSite: (siteId: string) => Promise<SiteForGeneration | null>;
  generatePost: typeof generateNewPost;
  proposeTopic: typeof proposeTopic;
  selectAnchors: typeof selectAnchorsForNewPost;
};

const SERP_COMPETITOR_LIMIT = 8;

const fetchSerpCompetitors = async (input: SerpLookup): Promise<ReadonlyArray<SerpCompetitor>> => {
  try {
    const result = await dataForSeo.serpOrganic(input, input.keyword);

    return result.top
      .filter((p) => p.domain !== input.domain.toLowerCase())
      .slice(0, SERP_COMPETITOR_LIMIT)
      .map((p) => ({ description: p.description, title: p.title }));
  } catch (error) {
    workerLog.warn({ err: error, keyword: input.keyword, message: "serp fetch failed" });

    return [];
  }
};

const createHandleGeneratePost = (dependencies: GeneratePostDependencies) =>
  async function handleGeneratePost({ log, payload }: JobContext<"GENERATE_POST">): Promise<void> {
    const { siteId } = payload;
    log.set({ siteId });

    const site = await dependencies.findSite(siteId);

    if (!site || !site.isEnabled) {
      log.warn("generate-post: site missing or disabled");

      return;
    }

    const [anchors, recentTitles, searchQueries] = await Promise.all([
      dependencies.selectAnchors({ niches: site.niches, siteId: site.id }),
      dependencies.findRecentTitles(site.id),
      dependencies.fetchSearchQueries(site.domain),
    ]);

    const topic = await dependencies.proposeTopic({
      language: site.language,
      niches: site.niches,
      recentTitles,
      searchQueries,
      topicHints: site.topicHints,
    });

    log.set({ focusKeyword: topic.focusKeyword });

    const competitors = await dependencies.fetchSerpCompetitors({
      domain: site.domain,
      keyword: topic.focusKeyword,
      language: site.language,
    });

    const topicHints =
      site.topicHints === null || site.topicHints === ""
        ? `Angle for this post: ${topic.angle}`
        : `${site.topicHints}\nAngle for this post: ${topic.angle}`;

    const generated = await dependencies.generatePost({
      anchors,
      serpContext: { competitors, focusKeyword: topic.focusKeyword },
      site: {
        domain: site.domain,
        language: site.language,
        moneySiteName: site.moneySite?.name ?? null,
        niches: site.niches,
      },
      topicHints,
    });

    const { post } = await dependencies.createPost({
      body: generated.body,
      categories: [generated.category],
      excerpt: generated.excerpt,
      focusKeyword: generated.focusKeyword,
      niches: site.niches,
      publish: false,
      siteId,
      slug: generated.slug,
      tags: [...generated.tags],
      title: generated.title,
    });

    // Retrying GENERATE_POST would create a second draft; publish records this intent again.
    try {
      await dependencies.enqueueJob({
        kind: JobKind.GENERATE_BODY_IMAGES,
        payload: { postId: post.id },
        postId: post.id,
      });
    } catch (error) {
      workerLog.warn({ err: error, message: "body-image enqueue failed", postId: post.id });
    }

    log.set({ postSlug: generated.slug, postTitle: generated.title });
    log.info("generate-post: draft added to bucket");
  };

const handleGeneratePost = createHandleGeneratePost({
  createPost: Posts.create,
  enqueueJob: enqueue,
  fetchSearchQueries: fetchTopSearchQueries,
  fetchSerpCompetitors,
  findRecentTitles: async (siteId) => {
    const posts = await prisma.post.findMany({
      orderBy: { createdAt: "desc" },
      select: { title: true },
      take: 30,
      where: { siteId },
    });

    return posts.map((p) => p.title);
  },
  findSite: (siteId) =>
    prisma.site.findUnique({
      include: { moneySite: { select: { name: true } } },
      where: { id: siteId },
    }),
  generatePost: generateNewPost,
  proposeTopic,
  selectAnchors: selectAnchorsForNewPost,
});

export { createHandleGeneratePost, handleGeneratePost };

export type { GeneratePostDependencies, SiteForGeneration };
