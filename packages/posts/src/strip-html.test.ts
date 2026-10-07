import { describe, expect, it } from "vitest";

import { stripHtml } from "./strip-html";

describe("stripHtml", () => {
  it("drops comments and tags, decodes entities, and collapses whitespace", () => {
    expect(
      stripHtml(
        "<!-- wp:paragraph --><p>Tom &amp; Jerry&nbsp;<a href='/x'>link</a></p>\n\n<p>Fim</p>",
      ),
    ).toBe("Tom & Jerry link Fim");
  });

  it("leaves Markdown text intact", () => {
    expect(stripHtml("## Título\n\nUm parágrafo com **negrito**.")).toBe(
      "## Título Um parágrafo com **negrito**.",
    );
  });
});
