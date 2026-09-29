import { describe, expect, it } from "vitest";

import { filterCandidates, type Candidate } from "./suggest";

const candidate = (over: Partial<Candidate> = {}): Candidate => ({
  id: "cand",
  link: "https://x.tld/y",
  niches: ["WEDDING"],
  similarity: 0.9,
  siteId: "site",
  siteIsEnabled: true,
  slug: "y",
  title: "Cand",
  ...over,
});

describe("filterCandidates", () => {
  it("drops candidates already linked from ref in any state", () => {
    const out = filterCandidates({
      candidates: [candidate({ id: "a" }), candidate({ id: "b" })],
      existingLinkTargets: new Set(["a"]),
    });
    expect(out.map((c) => c.id)).toEqual(["b"]);
  });

  it("drops candidates from disabled sites (defense in depth)", () => {
    const out = filterCandidates({
      candidates: [candidate({ id: "a", siteIsEnabled: false }), candidate({ id: "b" })],
      existingLinkTargets: new Set(),
    });
    expect(out.map((c) => c.id)).toEqual(["b"]);
  });
});
