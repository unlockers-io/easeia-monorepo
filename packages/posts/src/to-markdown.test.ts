import { describe, expect, it } from "vitest";

import { toMarkdown } from "./to-markdown";

describe("toMarkdown", () => {
  it("returns plain Markdown unchanged", () => {
    const md = "## Heading\n\nA paragraph with **bold** and a [link](https://example.com).";
    expect(toMarkdown(md)).toBe(md);
  });

  it("returns prose-only text unchanged", () => {
    const text = "Just some prose, no tags here.";
    expect(toMarkdown(text)).toBe(text);
  });

  it("converts WordPress Gutenberg blocks to Markdown", () => {
    const wp =
      "<!-- wp:paragraph -->\n<p>Hello <strong>world</strong>.</p>\n<!-- /wp:paragraph -->";

    expect(toMarkdown(wp)).toBe("Hello **world**.");
  });

  it("keeps a Markdown link written inside WordPress blocks as a link", () => {
    const wp =
      "<!-- wp:paragraph -->\n<p>Veja [o guia](https://example.com/guia?a=1&b=2).</p>\n<!-- /wp:paragraph -->";

    expect(toMarkdown(wp)).toBe("Veja [o guia](https://example.com/guia?a=1&b=2).");
  });

  it("converts plain HTML to Markdown", () => {
    const html = "<h2>Title</h2><p>Paragraph.</p>";
    expect(toMarkdown(html)).toBe("## Title\n\nParagraph.");
  });

  it("converts an HTML table to a Markdown table", () => {
    const html =
      "<h2>Custos</h2><table><thead><tr><th>Item</th><th>Custo</th></tr></thead><tbody><tr><td>Aluguel</td><td>1.000</td></tr></tbody></table>";

    expect(toMarkdown(html)).toBe(
      "## Custos\n\n| Item | Custo |\n| --- | --- |\n| Aluguel | 1.000 |",
    );
  });

  it("converts a WordPress table block to a Markdown table", () => {
    const wp =
      '<!-- wp:table -->\n<figure class="wp-block-table"><table><thead><tr><th>Tipo</th><th>Vantagem</th></tr></thead><tbody><tr><td>Casa</td><td>Janelas <a href="https://example.com/casa">grandes</a></td></tr></tbody></table></figure>\n<!-- /wp:table -->';

    expect(toMarkdown(wp)).toBe(
      "| Tipo | Vantagem |\n| --- | --- |\n| Casa | Janelas [grandes](https://example.com/casa) |",
    );
  });

  it("preserves image references in figures", () => {
    const html =
      '<figure><img src="https://example.com/a.jpg" alt="Alt text"/><figcaption>Caption</figcaption></figure>';

    expect(toMarkdown(html)).toContain("![Alt text](https://example.com/a.jpg)");
    expect(toMarkdown(html)).toContain("*Caption*");
  });

  // Regression: a Markdown autolink (`<https://…>`) used to trip the HTML guard,
  // routing the whole Markdown body through Turndown, which escaped `*`/`#` and
  // collapsed every newline into one block. Markdown must pass through untouched.
  it("leaves Markdown with an autolink unchanged", () => {
    const md = "See the guide at <https://example.com> for more details.";
    expect(toMarkdown(md)).toBe(md);
  });

  it("leaves structured Markdown containing an autolink unchanged", () => {
    const md =
      "**Bold intro.**\n\n## Heading\n\nA paragraph. Source: <https://example.com/guia>.\n\n- first\n- second";

    const out = toMarkdown(md);
    expect(out).toBe(md);
    expect(out).not.toContain(String.raw`\*`);
    expect(out).toContain("\n\n");
  });

  it("leaves prose with a stray `<` unchanged", () => {
    const md = "Mantenha o preço < R$ 100 por noite quando possível.";
    expect(toMarkdown(md)).toBe(md);
  });

  it("leaves Markdown with an inline HTML anchor unchanged", () => {
    const md =
      "## Filmagem\n\nUse locais com luz natural, como a " +
      '<a href="https://example.com/spaces/galeria">Galeria</a>.\n\n- primeiro\n- segundo';

    const out = toMarkdown(md);
    expect(out).toBe(md);
    expect(out).not.toContain(String.raw`\#`);
    expect(out).toContain("\n\n");
  });

  it("leaves Markdown with inline emphasis tags unchanged", () => {
    const md = "Texto com <strong>peso</strong>, <em>ênfase</em> e uma quebra<br/>simples.";
    expect(toMarkdown(md)).toBe(md);
  });

  it("still converts HTML whose blocks sit next to Markdown-looking lines", () => {
    const html = "<p>Intro.</p>\n\n<ul>\n<li>um</li>\n<li>dois</li>\n</ul>";
    expect(toMarkdown(html)).toBe("Intro.\n\n-   um\n-   dois");
  });
});
