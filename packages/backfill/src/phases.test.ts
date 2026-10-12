import { describe, expect, it } from "vitest";

import { nextNetworkPhase, type NetworkCounts } from "./network";
import { nextRewritePhase, type RewriteCounts } from "./rewrite";

const network = (over: Partial<NetworkCounts> = {}): NetworkCounts => ({
  classifiedPosts: 1235,
  embeddedPosts: 1235,
  posts: 1235,
  sites: 12,
  suggestDone: 1235,
  ...over,
});

const rewrite = (over: Partial<RewriteCounts> = {}): RewriteCounts => ({
  moneySitePagesCrawled: 40,
  moneySitePagesTotal: 40,
  postsEligible: 1235,
  postsRewritten: 1235,
  ...over,
});

describe("nextNetworkPhase", () => {
  it("stays on CLASSIFY_EMBED until both classify and embed cover every post", () => {
    expect(nextNetworkPhase("CLASSIFY_EMBED", network({ classifiedPosts: 1234 }))).toBe(
      "CLASSIFY_EMBED",
    );
    expect(nextNetworkPhase("CLASSIFY_EMBED", network({ embeddedPosts: 1234 }))).toBe(
      "CLASSIFY_EMBED",
    );
    expect(nextNetworkPhase("CLASSIFY_EMBED", network())).toBe("SUGGEST_LINKS");
  });

  it("finishes once every post has its suggestions", () => {
    expect(nextNetworkPhase("SUGGEST_LINKS", network({ suggestDone: 1234 }))).toBe("SUGGEST_LINKS");
    expect(nextNetworkPhase("SUGGEST_LINKS", network())).toBe("DONE");
  });
});

describe("nextRewritePhase", () => {
  it("stays on CRAWL_MONEY_SITE until every catalog page is crawled", () => {
    expect(nextRewritePhase("CRAWL_MONEY_SITE", rewrite({ moneySitePagesCrawled: 39 }))).toBe(
      "CRAWL_MONEY_SITE",
    );
    expect(nextRewritePhase("CRAWL_MONEY_SITE", rewrite())).toBe("REWRITE_POST");
  });

  it("waits on an empty catalog instead of skipping the crawl", () => {
    expect(
      nextRewritePhase(
        "CRAWL_MONEY_SITE",
        rewrite({ moneySitePagesCrawled: 0, moneySitePagesTotal: 0 }),
      ),
    ).toBe("CRAWL_MONEY_SITE");
  });

  it("finishes once every eligible post is rewritten", () => {
    expect(nextRewritePhase("REWRITE_POST", rewrite({ postsRewritten: 1234 }))).toBe(
      "REWRITE_POST",
    );
    expect(nextRewritePhase("REWRITE_POST", rewrite())).toBe("DONE");
  });
});
