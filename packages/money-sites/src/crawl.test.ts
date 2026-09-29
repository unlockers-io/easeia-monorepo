import { describe, expect, it, vi } from "vitest";

import { createCrawlSitemap } from "./crawl";

describe("crawlSitemap fetch", () => {
  it("issues the sitemap fetch with an abort signal (timeout)", async () => {
    const findSite = vi.fn().mockResolvedValueOnce({
      contentPathPrefix: null,
      sitemapUrl: "https://money.test/sitemap.xml",
    });
    const fetchMock = vi.fn(() =>
      Promise.resolve(new Response("<urlset></urlset>", { status: 200 })),
    );
    const crawlSitemap = createCrawlSitemap({
      createPages: vi.fn().mockResolvedValue(0),
      fetchSitemap: fetchMock,
      findSite,
    });

    await crawlSitemap("ms1");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://money.test/sitemap.xml",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });
});
