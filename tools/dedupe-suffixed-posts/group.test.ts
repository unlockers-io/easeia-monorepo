import { assert, describe, expect, it } from "vitest";

import { groupSuffixedPosts, longestBody, type SuffixedCandidate } from "./group";

const post = (slug: string, body: string, siteId = "s1"): SuffixedCandidate => ({
  body,
  id: slug,
  siteId,
  slug,
});

describe("groupSuffixedPosts", () => {
  it("pairs a suffixed copy with its base", () => {
    const groups = groupSuffixedPosts([post("guia", "a"), post("guia-2", "bb")]);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.base.slug).toBe("guia");
    expect(groups[0]?.dupes.map((d) => d.slug)).toEqual(["guia-2"]);
  });

  it("collects several copies of one base into a single group", () => {
    const groups = groupSuffixedPosts([
      post("guia", "a"),
      post("guia-2", "bb"),
      post("guia-3", "ccc"),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.dupes.map((d) => d.slug)).toEqual(["guia-2", "guia-3"]);
  });

  /**
   * Per-pair grouping compared each copy against the base's pre-run body, so
   * `guia-3` could overwrite the longer body `guia-2` had just moved.
   */
  it("keeps the longest body across the whole group, not the last copy seen", () => {
    const [group] = groupSuffixedPosts([
      post("guia", "short"),
      post("guia-2", "the longest body of the three"),
      post("guia-3", "medium body"),
    ]);
    assert(group, "expected one group");
    const source = longestBody([group.base, ...group.dupes]);
    expect(source.slug).toBe("guia-2");
    expect(source.body).toBe("the longest body of the three");
  });

  it("never pairs across sites, even on an identical slug", () => {
    const groups = groupSuffixedPosts([post("guia", "a", "s1"), post("guia-2", "bb", "s2")]);
    expect(groups).toEqual([]);
  });

  it("ignores a suffixed slug whose base does not exist", () => {
    expect(groupSuffixedPosts([post("guia-2", "bb")])).toEqual([]);
  });

  it("leaves unsuffixed slugs alone", () => {
    expect(groupSuffixedPosts([post("guia", "a"), post("outro", "b")])).toEqual([]);
  });
});

describe("longestBody", () => {
  it("picks the longest and treats a null body as empty", () => {
    const candidates = [
      { body: null, id: "a" },
      { body: "xx", id: "b" },
    ];
    expect(longestBody(candidates).id).toBe("b");
  });

  it("keeps the earliest candidate on a tie, so the base wins over a copy", () => {
    const candidates = [
      { body: "same", id: "base" },
      { body: "same", id: "copy" },
    ];
    expect(longestBody(candidates).id).toBe("base");
  });
});
