import { JobKind, prisma } from "@repo/db";
import { countJobs } from "@repo/jobs";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import { crawlSitemap, MoneySiteNotFoundError, requestCrawl } from "./index";

describe.runIf(process.env.TEST_DATABASE === "true")("money-site crawls", () => {
  const domain = `money-${crypto.randomUUID()}.test`;

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  afterAll(async () => {
    const pages = await prisma.moneySitePage.findMany({
      select: { id: true },
      where: { moneySite: { domain } },
    });

    for (const page of pages) {
      await prisma.job.deleteMany({
        where: { payload: { equals: { moneySitePageId: page.id } } },
      });
    }

    await prisma.moneySite.deleteMany({ where: { domain } });
  });

  it("records the sitemap's content pages and queues a crawl for each, with a timeout", async () => {
    const site = await prisma.moneySite.create({
      data: {
        contentPathPrefix: "/blog/",
        domain,
        name: "Money",
        sitemapUrl: `https://${domain}/sitemap.xml`,
      },
    });

    const fetchMock = vi.fn(() =>
      Promise.resolve(
        new Response(
          `<urlset><url><loc>https://${domain}/blog/a</loc></url><url><loc>https://${domain}/about</loc></url></urlset>`,
        ),
      ),
    );

    vi.stubGlobal("fetch", fetchMock);

    const result = await crawlSitemap(site.id);
    const pages = await prisma.moneySitePage.findMany({ where: { moneySiteId: site.id } });

    expect(fetchMock).toHaveBeenCalledWith(
      `https://${domain}/sitemap.xml`,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(result).toEqual({ discovered: 2, enqueued: 1, upserted: 1 });
    expect(pages.map((page) => page.url)).toEqual([`https://${domain}/blog/a`]);
    expect(await countJobs({ kinds: [JobKind.CRAWL_MONEY_SITE_PAGE] })).toBeGreaterThanOrEqual(1);
  });

  it("refuses to queue a crawl for a money site that does not exist", async () => {
    await expect(requestCrawl("missing")).rejects.toBeInstanceOf(MoneySiteNotFoundError);
  });
});
