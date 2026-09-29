import { LinkType } from "@repo/db";
import { describe, expect, it } from "vitest";

import { classifyLinks } from "./classify";
import type { ExtractedLink } from "./extract";

const link = (href: string, position = 0): ExtractedLink => ({
  anchorText: "anchor",
  href,
  position,
  rel: null,
});

const base = "https://own.tld/wp-json";
const params = (links: Array<ExtractedLink>) => ({
  base,
  links,
  network: [
    { domain: "own.tld", id: "site-own" },
    { domain: "pbn.tld", id: "site-pbn" },
  ],
  ownSiteDomain: "own.tld",
  ownSiteId: "site-own",
});

describe("classifyLinks", () => {
  it("classifies same-domain links as INTERNAL with own siteId", () => {
    const [out] = classifyLinks(params([link("/internal-post")]));
    expect(out?.type).toBe(LinkType.INTERNAL);
    expect(out?.toSiteId).toBe("site-own");
  });

  it("classifies network-domain links as PBN with that site's id", () => {
    const [out] = classifyLinks(params([link("https://pbn.tld/cool-post")]));
    expect(out?.type).toBe(LinkType.PBN);
    expect(out?.toSiteId).toBe("site-pbn");
  });

  it("classifies off-network domains as EXTERNAL with no toSiteId", () => {
    const [out] = classifyLinks(params([link("https://random.tld/article")]));
    expect(out?.type).toBe(LinkType.EXTERNAL);
    expect(out?.toSiteId).toBeNull();
  });

  it("treats www. and bare domains as the same site", () => {
    const out = classifyLinks(params([link("https://www.pbn.tld/post")]));
    expect(out[0]?.type).toBe(LinkType.PBN);
    expect(out[0]?.toSiteId).toBe("site-pbn");
  });

  it("derives slug as the last non-empty path segment", () => {
    const out = classifyLinks(
      params([
        link("/foo/bar/"),
        link("https://pbn.tld/x/y/z"),
        link("https://random.tld/article-name"),
      ]),
    );
    expect(out.map((l) => l.slug)).toEqual(["bar", "z", "article-name"]);
  });

  it("returns null slug for unparseable hrefs", () => {
    const out = classifyLinks(params([link("https://"), link("not a url at all")]));
    expect(out[0]?.slug).toBeNull();
  });

  it("preserves position, anchorText, rel from the input", () => {
    const out = classifyLinks(
      params([{ anchorText: "click", href: "/x", position: 5, rel: "nofollow" }]),
    );
    expect(out[0]).toMatchObject({
      anchorText: "click",
      href: "/x",
      position: 5,
      rel: "nofollow",
    });
  });
});
