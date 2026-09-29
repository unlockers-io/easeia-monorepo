import { describe, expect, it } from "vitest";

import { filterByNiche, type CandidateRow } from "./find-relevant";

const row = (over: Partial<CandidateRow>): CandidateRow => ({
  id: "p1",
  niches: ["WEDDING"],
  similarity: 0.9,
  title: "T",
  url: "https://x.tld/p1",
  ...over,
});

describe("filterByNiche", () => {
  it("keeps candidates with at least one niche in common", () => {
    const out = filterByNiche(
      [row({ niches: ["WEDDING"] }), row({ id: "p2", niches: ["TECH"] })],
      ["WEDDING", "FASHION"],
    );
    expect(out.map((r) => r.id)).toEqual(["p1"]);
  });

  it("falls back to all candidates when post has no niches", () => {
    const out = filterByNiche([row({ id: "p1" }), row({ id: "p2", niches: ["TECH"] })], []);
    expect(out.map((r) => r.id).toSorted()).toEqual(["p1", "p2"]);
  });
});
