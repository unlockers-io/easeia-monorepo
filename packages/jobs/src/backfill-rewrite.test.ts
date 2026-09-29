import { describe, expect, it } from "vitest";

import { nextBackfillRewritePhase, type BackfillRewriteCounts } from "./backfill-rewrite";

const c = (over: Partial<BackfillRewriteCounts> = {}): BackfillRewriteCounts => ({
  moneySitePagesCrawled: 40,
  moneySitePagesTotal: 40,
  postsEligible: 1235,
  postsRewritten: 1235,
  ...over,
});

describe("nextBackfillRewritePhase", () => {
  it("stays on CRAWL_MONEY_SITE until every catalog page is crawled", () => {
    expect(nextBackfillRewritePhase("CRAWL_MONEY_SITE", c({ moneySitePagesCrawled: 39 }))).toBe(
      "CRAWL_MONEY_SITE",
    );
    expect(nextBackfillRewritePhase("CRAWL_MONEY_SITE", c({ moneySitePagesCrawled: 40 }))).toBe(
      "REWRITE_POST",
    );
  });

  it("advances REWRITE_POST → DONE only when all eligible posts are rewritten", () => {
    expect(nextBackfillRewritePhase("REWRITE_POST", c({ postsRewritten: 1234 }))).toBe(
      "REWRITE_POST",
    );
    expect(nextBackfillRewritePhase("REWRITE_POST", c())).toBe("DONE");
  });

  it("DONE is terminal", () => {
    expect(nextBackfillRewritePhase("DONE", c())).toBe("DONE");
  });
});
