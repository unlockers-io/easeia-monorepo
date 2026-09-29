import { describe, expect, it } from "vitest";

import { findMissingAnchors } from "./rewrite";

describe("findMissingAnchors", () => {
  it("returns anchors whose url does not appear in the body", () => {
    const body = '<p>See <a href="https://a.tld/x">A</a>.</p>';
    const anchors = [
      { anchor: "A", reason: "", url: "https://a.tld/x" },
      { anchor: "B", reason: "", url: "https://b.tld/y" },
    ];
    expect(findMissingAnchors(body, anchors).map((a) => a.url)).toEqual(["https://b.tld/y"]);
  });

  it("returns empty when all anchors are present", () => {
    const body = '<p><a href="https://a.tld/x">A</a> <a href="https://b.tld/y">B</a></p>';
    const anchors = [
      { anchor: "A", reason: "", url: "https://a.tld/x" },
      { anchor: "B", reason: "", url: "https://b.tld/y" },
    ];
    expect(findMissingAnchors(body, anchors)).toEqual([]);
  });
});
