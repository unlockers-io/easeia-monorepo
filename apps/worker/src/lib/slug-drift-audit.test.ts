import { beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  Object.assign(process.env, {
    DATABASE_URL: "postgresql://test:test@localhost:5440/easeia_test",
    REDIS_URL: "redis://localhost:6381",
    WP_ENCRYPTION_KEY: "test-encryption-key",
  });
});

import { makeAuditSlugDrift } from "./slug-drift-audit";

const logger = { error: vi.fn(), info: vi.fn(), warn: vi.fn() };

const SITE = {
  categorySlugMap: { Tech: "tecnologia" },
  defaultCategory: "sem-categoria",
  domain: "example.com",
  id: "s1",
};

const sitemapFetcher = (urls: Array<string>) => {
  const index = `<sitemapindex><sitemap><loc>https://www.example.com/sitemap-0.xml</loc></sitemap></sitemapindex>`;
  const page = `<urlset>${urls.map((u) => `<url><loc>${u}</loc></url>`).join("")}</urlset>`;
  return vi.fn((url: string) => Promise.resolve(url.endsWith("sitemap-index.xml") ? index : page));
};

describe("auditSlugDrift", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passes when every derived path exists in the live sitemap", async () => {
    const audit = makeAuditSlugDrift({
      fetchText: sitemapFetcher([
        "https://www.example.com/tecnologia/",
        "https://www.example.com/tecnologia/post-a/",
        "https://www.example.com/tag/tecnologia/",
      ]),
      findPosts: () => Promise.resolve([{ categories: ["Tech"], siteId: "s1", slug: "post-a" }]),
      findSites: () => Promise.resolve([SITE]),
      logger,
    });
    const result = await audit();
    expect(result).toEqual({ mismatched: 0, missing: 0, sitesChecked: 1, sitesSkipped: 0 });
    expect(logger.error).not.toHaveBeenCalled();
  });

  it("reports a mismatch when the live path uses another category segment", async () => {
    const audit = makeAuditSlugDrift({
      fetchText: sitemapFetcher(["https://www.example.com/tech/post-a/"]),
      findPosts: () => Promise.resolve([{ categories: ["Tech"], siteId: "s1", slug: "post-a" }]),
      findSites: () => Promise.resolve([SITE]),
      logger,
    });
    const result = await audit();
    expect(result.mismatched).toBe(1);
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        domain: "example.com",
        mismatchedExamples: [
          { derived: "/tecnologia/post-a/", live: "/tech/post-a/", slug: "post-a" },
        ],
      }),
    );
  });

  it("reports missing when the slug is nowhere in the sitemap", async () => {
    const audit = makeAuditSlugDrift({
      fetchText: sitemapFetcher(["https://www.example.com/tecnologia/other-post/"]),
      findPosts: () => Promise.resolve([{ categories: ["Tech"], siteId: "s1", slug: "post-a" }]),
      findSites: () => Promise.resolve([SITE]),
      logger,
    });
    const result = await audit();
    expect(result.missing).toBe(1);
    expect(result.mismatched).toBe(0);
  });

  it("falls back to slugify for unmapped categories", async () => {
    const audit = makeAuditSlugDrift({
      fetchText: sitemapFetcher(["https://www.example.com/locacao/post-a/"]),
      findPosts: () => Promise.resolve([{ categories: ["Locação"], siteId: "s1", slug: "post-a" }]),
      findSites: () => Promise.resolve([SITE]),
      logger,
    });
    const result = await audit();
    expect(result).toMatchObject({ mismatched: 0, missing: 0 });
  });

  it("skips a site whose sitemap cannot be fetched without failing the sweep", async () => {
    const audit = makeAuditSlugDrift({
      fetchText: vi.fn(() => Promise.reject(new Error("timeout"))),
      findPosts: () => Promise.resolve([{ categories: ["Tech"], siteId: "s1", slug: "post-a" }]),
      findSites: () => Promise.resolve([SITE]),
      logger,
    });
    const result = await audit();
    expect(result).toEqual({ mismatched: 0, missing: 0, sitesChecked: 0, sitesSkipped: 1 });
    expect(logger.warn).toHaveBeenCalled();
  });

  it("skips sites with no published posts", async () => {
    const fetchText = vi.fn();
    const audit = makeAuditSlugDrift({
      fetchText,
      findPosts: () => Promise.resolve([]),
      findSites: () => Promise.resolve([SITE]),
      logger,
    });
    const result = await audit();
    expect(result.sitesChecked).toBe(0);
    expect(fetchText).not.toHaveBeenCalled();
  });
});
