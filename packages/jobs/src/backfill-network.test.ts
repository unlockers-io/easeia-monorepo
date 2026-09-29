import { describe, expect, it } from "vitest";

import {
  isBackfillNetworkPhase,
  nextBackfillNetworkPhase,
  type BackfillNetworkCounts,
} from "./backfill-network";

const c = (over: Partial<BackfillNetworkCounts> = {}): BackfillNetworkCounts => ({
  classifiedPosts: 1235,
  embeddedPosts: 1235,
  posts: 1235,
  suggestLinksDone: 1235,
  ...over,
});

describe("nextBackfillNetworkPhase", () => {
  it("stays on CLASSIFY_EMBED until both classify and embed are 100%", () => {
    expect(
      nextBackfillNetworkPhase("CLASSIFY_EMBED", c({ classifiedPosts: 1234, embeddedPosts: 1235 })),
    ).toBe("CLASSIFY_EMBED");
    expect(
      nextBackfillNetworkPhase("CLASSIFY_EMBED", c({ classifiedPosts: 1235, embeddedPosts: 1234 })),
    ).toBe("CLASSIFY_EMBED");
  });

  it("advances CLASSIFY_EMBED → SUGGEST_LINKS when both are done", () => {
    expect(nextBackfillNetworkPhase("CLASSIFY_EMBED", c())).toBe("SUGGEST_LINKS");
  });

  it("stays on SUGGEST_LINKS until every post has a suggestion", () => {
    expect(nextBackfillNetworkPhase("SUGGEST_LINKS", c({ suggestLinksDone: 1234 }))).toBe(
      "SUGGEST_LINKS",
    );
  });

  it("advances SUGGEST_LINKS → DONE when all posts done", () => {
    expect(nextBackfillNetworkPhase("SUGGEST_LINKS", c({ suggestLinksDone: 1235 }))).toBe("DONE");
  });

  it("stays DONE once done", () => {
    expect(nextBackfillNetworkPhase("DONE", c())).toBe("DONE");
  });
});

describe("isBackfillNetworkPhase", () => {
  it("accepts every live phase", () => {
    expect(isBackfillNetworkPhase("CLASSIFY_EMBED")).toBe(true);
    expect(isBackfillNetworkPhase("SUGGEST_LINKS")).toBe(true);
    expect(isBackfillNetworkPhase("DONE")).toBe(true);
  });

  it("rejects retired or unknown phases", () => {
    expect(isBackfillNetworkPhase("SYNC")).toBe(false);
    expect(isBackfillNetworkPhase(undefined)).toBe(false);
  });
});
