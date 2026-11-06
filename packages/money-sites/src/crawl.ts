import { AiNotConfiguredError, embedDocument } from "@repo/ai";
import { classifyContent, type ClassifyContentResult } from "@repo/classify";
import { JobKind, prisma, vectorLiteral } from "@repo/db";
import { enqueue, type EnqueueInput, type RunTarget } from "@repo/jobs";

import { extractPageContent } from "./extract";
import { extractLocs, filterContentPaths } from "./sitemap";

const MAX_EXCERPT_CHARS = 1000;
const MAX_BODY_CHARS = 8000;

const userAgent = "Easeia/1.0 (+https://easeia.dev)";

const LONG_TRANSACTION = { timeout: 60_000 };

type CrawlSitemapResult = {
  discovered: number;
  enqueued: number;
  upserted: number;
};

export const crawlSitemap = async (
  moneySiteId: string,
  run?: Omit<RunTarget, "member">,
): Promise<CrawlSitemapResult> => {
  const site = await prisma.moneySite.findUnique({ where: { id: moneySiteId } });

  if (!site) {
    return { discovered: 0, enqueued: 0, upserted: 0 };
  }

  const res = await fetch(site.sitemapUrl, {
    headers: { "User-Agent": userAgent },
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    throw new Error(`sitemap fetch ${res.status} from ${site.sitemapUrl}`);
  }

  const allUrls = extractLocs(await res.text());
  const contentUrls = filterContentPaths(allUrls, site.contentPathPrefix);

  return prisma.$transaction(async (tx) => {
    // skipDuplicates keeps the crawled fields of pages already on record.
    const { count: upserted } = await tx.moneySitePage.createMany({
      data: contentUrls.map((url) => ({ excerpt: "", moneySiteId, title: url, url })),
      skipDuplicates: true,
    });

    // oxlint-disable-next-line react-doctor/server-sequential-independent-await -- not independent: reads the pages createMany just added
    const pages = await tx.moneySitePage.findMany({ select: { id: true }, where: { moneySiteId } });

    for (const page of pages) {
      const job: EnqueueInput<"CRAWL_MONEY_SITE_PAGE"> = {
        kind: JobKind.CRAWL_MONEY_SITE_PAGE,
        payload: { moneySitePageId: page.id },
      };

      if (run !== undefined) {
        job.run = { ...run, member: page.id };
      }

      await enqueue(job, tx);
    }

    return { discovered: allUrls.length, enqueued: pages.length, upserted };
  }, LONG_TRANSACTION);
};

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

  const html = await res.text();
  const content = extractPageContent(html);
  const title = content.title ?? page.url;
  const bodyText = content.bodyText;
  const excerpt = (content.metaDescription ?? bodyText).slice(0, MAX_EXCERPT_CHARS);

  // Title and excerpt are worth recording without AI; classification and the embedding are not.
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
    embedding = await embedDocument(title, bodyText);
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
    await prisma.$executeRawUnsafe(
      `UPDATE "MoneySitePage" SET embedding = $1::vector WHERE id = $2`,
      vectorLiteral(embedding),
      moneySitePageId,
    );
  }

  return { classified: classified !== null, embedded: embedding !== null };
};
