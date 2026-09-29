import { describe, expect, it } from "vitest";

import { mergeTags, normalizeTag } from "./classify";

describe("normalizeTag", () => {
  it("lowercases and trims", () => {
    expect(normalizeTag(" Beach Editorials  ")).toBe("beach editorials");
  });
});

describe("mergeTags", () => {
  it("dedups case-insensitively, preserves existing order", () => {
    expect(mergeTags(["Wedding-Vibes", "Beach"], ["beach", "summer"])).toEqual([
      "wedding-vibes",
      "beach",
      "summer",
    ]);
  });

  it("drops fresh tags that match Niche enum values (those go in niches, not tags)", () => {
    expect(mergeTags([], ["wedding", "real-estate", "tuscany venues"])).toEqual(["tuscany venues"]);
  });
});

describe("classifyContent (content-agnostic)", () => {
  it("is exported", async () => {
    const m = await import("./classify");
    expect(typeof m.classifyContent).toBe("function");
  });
});
