import { serpOrganic } from "@repo/dataforseo";
import { JobKind, type Prisma, prisma, type SiteLanguage } from "@repo/db";
import { type ConsumerContext, enqueue } from "@repo/jobs";
import * as Posts from "@repo/posts";
import {
  generateNewPost,
  proposeTopic,
  selectAnchorsForNewPost,
  type SerpCompetitor,
} from "@repo/rewrite";

import { env } from "../lib/env";
import { fetchTopSearchQueries } from "../lib/gsc-queries";
import { createJobLogger, log as workerLog } from "../lib/logger";

type SiteForGeneration = Pick<
  Prisma.SiteGetPayload<{
    include: { moneySite: { select: { name: true } } };
  }>,
  "domain" | "id" | "isEnabled" | "language" | "moneySite" | "niches" | "topicHints"
>;

type GeneratePostLog = Pick<ReturnType<typeof createJobLogger>, "emit" | "info" | "set" | "warn">;

type SerpLookup = {
  domain: string;
  keyword: string;
  language: SiteLanguage;
};

type GeneratePostDependencies = {
  bodyImagesEnabled: boolean;
  createLogger: (context: Parameters<typeof createJobLogger>[0]) => GeneratePostLog;
  createPost: typeof Posts.create;
  enqueueJob: typeof enqueue;
  fetchSearchQueries: (domain: string) => Promise<ReadonlyArray<string>>;
  fetchSerpCompetitors: (input: SerpLookup) => Promise<ReadonlyArray<SerpCompetitor>>;
  findRecentTitles: (siteId: string) => Promise<ReadonlyArray<string>>;
  findSite: (siteId: string) => Promise<SiteForGeneration | null>;
  generatePost: typeof generateNewPost;
  proposeTopic: typeof proposeTopic;
  redisUrl: string;
  selectAnchors: typeof selectAnchorsForNewPost;
};

const SERP_COMPETITOR_LIMIT = 8;

// DataForSEO location/language codes per site language. The network targets
// Brazil (PT), Spain (ES), and the US (EN); SERPs differ per market, so the
// lookup must match where the site's readers actually search.
const SERP_LOCALE = {
  EN: { languageCode: "en", locationCode: 2840 },
  ES: { languageCode: "es", locationCode: 2724 },
  PT: { languageCode: "pt", locationCode: 2076 },
} satisfies Record<SiteLanguage, { languageCode: string; locationCode: number }>;

const fetchSerpCompetitors = async (input: SerpLookup): Promise<ReadonlyArray<SerpCompetitor>> => {
  try {
    const locale = SERP_LOCALE[input.language];
    const result = await serpOrganic(
      input.keyword,
      input.domain,
      locale.locationCode,
      locale.languageCode,
    );
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
  async function handleGeneratePost(ctx: ConsumerContext<"GENERATE_POST">): Promise<void> {
    const { jobId, payload } = ctx;
    const { siteId } = payload;
    const log = dependencies.createLogger({ jobId, queue: "generate-post" });
    log.set({ siteId });

    const site = await dependencies.findSite(siteId);
    if (!site || !site.isEnabled) {
      log.warn("generate-post: site missing or disabled");
      log.emit();
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

    const { post } = await dependencies.createPost(
      {
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
      },
      { redisUrl: dependencies.redisUrl },
    );

    if (dependencies.bodyImagesEnabled) {
      // Retrying GENERATE_POST would create a second draft; publish retries this fanout.
      try {
        await dependencies.enqueueJob({
          kind: JobKind.GENERATE_BODY_IMAGES,
          payload: { postId: post.id },
          postId: post.id,
          redisUrl: dependencies.redisUrl,
        });
      } catch (error) {
        workerLog.warn({ err: error, message: "body-image enqueue failed", postId: post.id });
      }
    }

    log.set({ postSlug: generated.slug, postTitle: generated.title });
    log.info("generate-post: draft added to bucket");
    log.emit();
  };

const handleGeneratePost = createHandleGeneratePost({
  bodyImagesEnabled: env.BODY_IMAGES_ENABLED,
  createLogger: createJobLogger,
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
  redisUrl: env.REDIS_URL,
  selectAnchors: selectAnchorsForNewPost,
});

export { createHandleGeneratePost, handleGeneratePost };
export type { GeneratePostDependencies, SiteForGeneration };
