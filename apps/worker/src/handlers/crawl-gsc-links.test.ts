import { describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  Object.assign(process.env, {
    APP_URL: "https://app.test",
    DATABASE_URL: "postgresql://test:test@localhost:5440/easeia_test",
    REDIS_URL: "redis://localhost:6381",
    WP_ENCRYPTION_KEY: "test-encryption-key",
  });
});

import { aggregateByDomain, extractSourceDomain } from "./crawl-gsc-links";

describe("extractSourceDomain", () => {
  it("strips protocol and path, lowercases the host", () => {
    expect(extractSourceDomain("https://Forbes.com/some/article?ref=1")).toBe("forbes.com");
  });

  it("strips a leading www.", () => {
    expect(extractSourceDomain("https://www.nytimes.com/a/b")).toBe("nytimes.com");
  });

  it("returns null on malformed URLs", () => {
    expect(extractSourceDomain("not-a-url")).toBeNull();
  });

  it("preserves subdomains other than www", () => {
    expect(extractSourceDomain("https://blog.forbes.com/x")).toBe("blog.forbes.com");
  });
});

const rows = (...urls: Array<string>) => urls.map((referringUrl) => ({ referringUrl }));

describe("aggregateByDomain", () => {
  it("counts distinct referring pages per source domain", () => {
    const byDomain = aggregateByDomain(
      rows("https://forbes.com/a", "https://forbes.com/b", "https://nytimes.com/x"),
    );

    expect(byDomain.get("forbes.com")?.size).toBe(2);
    expect(byDomain.get("nytimes.com")?.size).toBe(1);
  });

  it("counts a repeated referring URL once", () => {
    const byDomain = aggregateByDomain(rows("https://forbes.com/a", "https://forbes.com/a"));

    expect(byDomain.get("forbes.com")?.size).toBe(1);
  });

  it("groups www and non-www under one domain", () => {
    const byDomain = aggregateByDomain(rows("https://www.forbes.com/a", "https://forbes.com/b"));

    expect(byDomain.size).toBe(1);
    expect(byDomain.get("forbes.com")?.size).toBe(2);
  });

  it("skips URLs it cannot parse rather than bucketing them under an empty key", () => {
    const byDomain = aggregateByDomain(rows("not-a-url", "https://forbes.com/a"));

    expect([...byDomain.keys()]).toEqual(["forbes.com"]);
  });

  it("returns an empty map for no rows", () => {
    expect(aggregateByDomain([]).size).toBe(0);
  });
});
