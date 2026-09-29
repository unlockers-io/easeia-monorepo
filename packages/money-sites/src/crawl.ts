import { AiNotConfiguredError, embedText } from "@repo/ai";
import { classifyContent, type ClassifyContentResult } from "@repo/classify";
import { prisma } from "@repo/db";

import { extractPageContent } from "./extract";
import { extractLocs, filterContentPaths } from "./sitemap";

const MAX_EXCERPT_CHARS = 1000;
const MAX_BODY_CHARS = 8000;
const MAX_EMBED_CHARS = 6000 * 4;

const userAgent = "Easeia/1.0 (+https://easeia.dev)";

const toVectorLiteral = (v: ReadonlyArray<number>): string => `[${v.join(",")}]`;

const recordPageEmbedding = async (
  pageId: string,
  vector: ReadonlyArray<number>,
): Promise<void> => {
  await prisma.$executeRawUnsafe(
    `UPDATE "MoneySitePage" SET embedding = $1::vector WHERE id = $2`,
    toVectorLiteral(vector),
    pageId,
  );
};

type CrawlSitemapResult = {
  discovered: number;
  upserted: number;
};

type CrawlSitemapDependencies = {
  createPages: (moneySiteId: string, urls: ReadonlyArray<string>) => Promise<number>;
  fetchSitemap: typeof fetch;
  findSite: (moneySiteId: string) => Promise<{
    contentPathPrefix: string | null;
    sitemapUrl: string;
  } | null>;
};

const createCrawlSitemap =
  (dependencies: CrawlSitemapDependencies) =>
  async (moneySiteId: string): Promise<CrawlSitemapResult> => {
    const site = await dependencies.findSite(moneySiteId);
    if (!site) {
      return { discovered: 0, upserted: 0 };
    }
    const res = await dependencies.fetchSitemap(site.sitemapUrl, {
      headers: { "User-Agent": userAgent },
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) {
      throw new Error(`sitemap fetch ${res.status} from ${site.sitemapUrl}`);
    }
    const xml = await res.text();
    const allUrls = extractLocs(xml);
    const contentUrls = filterContentPaths(allUrls, site.contentPathPrefix);

    // skipDuplicates preserves crawled fields on existing rows, matching the
    // previous insert-if-absent behavior.
    const upserted = await dependencies.createPages(moneySiteId, contentUrls);
    return { discovered: allUrls.length, upserted };
  };

const crawlSitemap = createCrawlSitemap({
  createPages: async (moneySiteId, urls) => {
    const created = await prisma.moneySitePage.createMany({
      data: urls.map((url) => ({ excerpt: "", moneySiteId, title: url, url })),
      skipDuplicates: true,
    });
    return created.count;
  },
  fetchSitemap: fetch,
  findSite: (moneySiteId) => prisma.moneySite.findUnique({ where: { id: moneySiteId } }),
});

export type CrawlPageResult = {
  classified: boolean;
  embedded: boolean;
};

export const crawlPage = async (moneySitePageId: string): Promise<CrawlPageResult> => {
  const page = await prisma.moneySitePage.findUnique({
    include: { moneySite: true },
    where: { id: moneySitePageId },
  });
  if (!page) {
    return { classified: false, embedded: false };
  }
  const res = await fetch(page.url, {
    headers: { "User-Agent": userAgent },
    redirect: "follow",
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    throw new Error(`page fetch ${res.status} from ${page.url}`);
  }
  // The dynamic import read as a lazy load but `./extract` imports linkedom
  // statically, so the module was always already resolved.
  const html = await res.text();
  const content = extractPageContent(html);
  const title = content.title ?? page.url;
  const bodyText = content.bodyText;
  const excerpt = (content.metaDescription ?? bodyText).slice(0, MAX_EXCERPT_CHARS);

  // Nullability belongs here, in the caller that treats "unclassified" as an
  // acceptable outcome, rather than in classifyContent's return type. This catch
  // used to be dead: classifyContent swallowed the error and returned null, so
  // the only branch here rethrew everything that reached it.
  let classified: ClassifyContentResult | null = null;
  try {
    classified = await classifyContent({
      body: bodyText.slice(0, MAX_BODY_CHARS),
      siteDomain: page.moneySite.domain,
      siteNiches: [],
      title,
    });
  } catch (error) {
    if (!(error instanceof AiNotConfiguredError)) {
      throw error;
    }
  }

  let embedding: Array<number> | null = null;
  try {
    embedding = await embedText(`${title}\n\n${bodyText.slice(0, MAX_EMBED_CHARS)}`);
  } catch (error) {
    if (!(error instanceof AiNotConfiguredError)) {
      throw error;
    }
  }

  await prisma.moneySitePage.update({
    data: {
      excerpt,
      lastCrawledAt: new Date(),
      niches: classified?.niches ?? [],
      tags: classified?.tags ?? [],
      title,
    },
    where: { id: moneySitePageId },
  });
  if (embedding) {
    await recordPageEmbedding(moneySitePageId, embedding);
  }
  return { classified: classified !== null, embedded: embedding !== null };
};

export { crawlSitemap, createCrawlSitemap };
export type { CrawlSitemapDependencies };
