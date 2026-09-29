import { describe, expect, it } from "vitest";

import { extractFromHtml } from "./extract";

describe("extractFromHtml", () => {
  it("returns anchors with positions, anchor text, and rel", () => {
    const html = `
      <p>First <a href="/foo">foo</a>.</p>
      <p>Second <a href="https://other.tld/bar" rel="nofollow">bar</a>.</p>
    `;
    expect(extractFromHtml(html)).toEqual([
      { anchorText: "foo", href: "/foo", position: 0, rel: null },
      { anchorText: "bar", href: "https://other.tld/bar", position: 1, rel: "nofollow" },
    ]);
  });

  it("skips fragment, mailto, tel, javascript hrefs", () => {
    const html = `
      <a href="#top">top</a>
      <a href="mailto:a@b.c">email</a>
      <a href="tel:+1">call</a>
      <a href="javascript:void(0)">js</a>
      <a href="/keep">keep</a>
    `;
    expect(extractFromHtml(html).map((l) => l.href)).toEqual(["/keep"]);
  });

  it("drops empty hrefs", () => {
    const html = `<a href="">empty</a><a href="  ">whitespace</a><a href="/ok">ok</a>`;
    expect(extractFromHtml(html).map((l) => l.href)).toEqual(["/ok"]);
  });

  it("preserves nested anchor text", () => {
    const html = `<a href="/x"><span>Wrapped <em>text</em></span></a>`;
    expect(extractFromHtml(html)[0]?.anchorText).toContain("Wrapped");
    expect(extractFromHtml(html)[0]?.anchorText).toContain("text");
  });

  it("returns empty array when no anchors", () => {
    expect(extractFromHtml("<p>plain</p>")).toEqual([]);
  });
});
