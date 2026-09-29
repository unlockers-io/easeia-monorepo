import { describe, expect, it } from "vitest";

import { normalizeBody } from "./normalize-body";

describe("normalizeBody", () => {
  it("returns plain Markdown unchanged", () => {
    const md = "## Heading\n\nA paragraph with **bold** and a [link](https://example.com).";
    expect(normalizeBody(md)).toBe(md);
  });

  it("returns prose-only text unchanged", () => {
    const text = "Just some prose, no tags here.";
    expect(normalizeBody(text)).toBe(text);
  });

  it("converts WordPress Gutenberg blocks to Markdown", () => {
    const wp =
      "<!-- wp:paragraph -->\n<p>Hello <strong>world</strong>.</p>\n<!-- /wp:paragraph -->";
    expect(normalizeBody(wp)).toBe("Hello **world**.");
  });

  it("converts plain HTML to Markdown", () => {
    const html = "<h2>Title</h2><p>Paragraph.</p>";
    expect(normalizeBody(html)).toBe("## Title\n\nParagraph.");
  });

  it("preserves image references in figures", () => {
    const html =
      '<figure><img src="https://example.com/a.jpg" alt="Alt text"/><figcaption>Caption</figcaption></figure>';
    expect(normalizeBody(html)).toContain("![Alt text](https://example.com/a.jpg)");
    expect(normalizeBody(html)).toContain("*Caption*");
  });

  // Regression: a Markdown autolink (`<https://…>`) used to trip the HTML guard,
  // routing the whole Markdown body through Turndown, which escaped `*`/`#` and
  // collapsed every newline into one block. Markdown must pass through untouched.
  it("leaves Markdown with an autolink unchanged", () => {
    const md = "See the guide at <https://example.com> for more details.";
    expect(normalizeBody(md)).toBe(md);
  });

  it("leaves structured Markdown containing an autolink unchanged", () => {
    const md =
      "**Bold intro.**\n\n## Heading\n\nA paragraph. Source: <https://example.com/guia>.\n\n- first\n- second";
    const out = normalizeBody(md);
    expect(out).toBe(md);
    expect(out).not.toContain(String.raw`\*`);
    expect(out).toContain("\n\n");
  });

  it("leaves prose with a stray `<` unchanged", () => {
    const md = "Mantenha o preço < R$ 100 por noite quando possível.";
    expect(normalizeBody(md)).toBe(md);
  });

  it("leaves Markdown with an inline HTML anchor unchanged", () => {
    const md =
      "## Filmagem\n\nUse locais com luz natural, como a " +
      '<a href="https://example.com/spaces/galeria">Galeria</a>.\n\n- primeiro\n- segundo';
    const out = normalizeBody(md);
    expect(out).toBe(md);
    expect(out).not.toContain(String.raw`\#`);
    expect(out).toContain("\n\n");
  });

  it("leaves Markdown with inline emphasis tags unchanged", () => {
    const md = "Texto com <strong>peso</strong>, <em>ênfase</em> e uma quebra<br/>simples.";
    expect(normalizeBody(md)).toBe(md);
  });

  it("still converts HTML whose blocks sit next to Markdown-looking lines", () => {
    const html = "<p>Intro.</p>\n\n<ul>\n<li>um</li>\n<li>dois</li>\n</ul>";
    expect(normalizeBody(html)).toBe("Intro.\n\n-   um\n-   dois");
  });
});
