import { LinkType } from "@repo/db";
import { describe, expect, it } from "vitest";

import type { ClassifiedLink, ResolvedLink } from "./classify";
import { fabricatedHrefs, stripAnchor, stripAnchors } from "./prune";

/** Only the "real" slug resolves, mirroring one hit in the batched lookup. */
const resolveAgainstRealOnly = (l: ClassifiedLink): ResolvedLink => ({
  ...l,
  toPostId: l.slug === "real" ? "p1" : null,
});

const link = (over: Partial<ClassifiedLink>): ClassifiedLink => ({
  anchorText: "x",
  href: "https://x.com/cat/slug/",
  position: 0,
  rel: null,
  slug: "slug",
  toSiteId: "site1",
  type: LinkType.INTERNAL,
  ...over,
});

describe("fabricatedHrefs", () => {
  it("flags internal/PBN links with no resolved post, keeps resolved + external", () => {
    const classified = [
      link({
        href: "https://a.com/c/real/",
        slug: "real",
        toSiteId: "s1",
        type: LinkType.INTERNAL,
      }),
      link({
        href: "https://a.com/c/fake/",
        slug: "fake",
        toSiteId: "s1",
        type: LinkType.INTERNAL,
      }),
      link({ href: "https://b.com/c/peer/", slug: "peer", toSiteId: "s2", type: LinkType.PBN }),
      link({ href: "https://ext.com/x", slug: "x", toSiteId: null, type: LinkType.EXTERNAL }),
    ];
    // The resolution is now attached to each link, so a caller cannot pass a
    // map keyed the wrong way and have every internal link judged fabricated.
    const resolved = classified.map(resolveAgainstRealOnly);
    const bad = fabricatedHrefs(resolved);
    expect(bad.has("https://a.com/c/fake/")).toBe(true);
    expect(bad.has("https://b.com/c/peer/")).toBe(true);
    expect(bad.has("https://a.com/c/real/")).toBe(false);
    expect(bad.has("https://ext.com/x")).toBe(false);
  });
});

describe("stripAnchor", () => {
  it("unwraps markdown and html anchors, keeps the text", () => {
    const body =
      'See [guia](https://a.com/c/fake/) and <a href="https://a.com/c/fake/" rel="ugc">guide</a>.';
    expect(stripAnchor(body, "https://a.com/c/fake/")).toBe("See guia and guide.");
  });

  it("does not touch a different href that shares a prefix", () => {
    const body = "[a](https://a.com/c/fake/) [b](https://a.com/c/fake-2/)";
    expect(stripAnchor(body, "https://a.com/c/fake/")).toBe("a [b](https://a.com/c/fake-2/)");
  });

  it("stripAnchors removes every listed href", () => {
    const body = "[a](https://a.com/x/) and [b](https://a.com/y/)";
    expect(stripAnchors(body, ["https://a.com/x/", "https://a.com/y/"])).toBe("a and b");
  });
});

describe("fabricatedHrefs null-attribution cases", () => {
  it("flags a non-EXTERNAL link the classifier could not attribute to a site", () => {
    const unattributed = [
      {
        ...link({ href: "https://a.com/x", slug: null, toSiteId: null, type: LinkType.INTERNAL }),
        toPostId: null,
      },
    ];

    expect(fabricatedHrefs(unattributed).has("https://a.com/x")).toBe(true);
  });

  it("never flags EXTERNAL links even when unresolved", () => {
    const external = [
      {
        ...link({ href: "https://ext.com/x", slug: null, toSiteId: null, type: LinkType.EXTERNAL }),
        toPostId: null,
      },
    ];

    expect(fabricatedHrefs(external).size).toBe(0);
  });
});
