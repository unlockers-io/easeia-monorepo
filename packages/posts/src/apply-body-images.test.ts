import { describe, expect, it } from "vitest";

import { applyBodyImages } from "./apply-body-images";

// Targets below are 1-based line numbers: array index + 1.
const body = [
  "## Primeira seção",
  "",
  "Um parágrafo sobre microfones.",
  "",
  "## Segunda seção",
  "",
  "Outro parágrafo sobre acústica.",
  "",
  "## Terceira seção",
  "",
  "Fecho do texto.",
].join("\n");

describe("applyBodyImages", () => {
  it("returns the body untouched when there is nothing to insert", () => {
    expect(applyBodyImages(body, [])).toBe(body);
  });

  it("inserts every image after its target line, blank-line separated", () => {
    const out = applyBodyImages(body, [
      { alt: "Um microfone", line: 3, url: "https://img.easeia.com/a.jpg" },
      { alt: "Painéis acústicos", line: 7, url: "https://img.easeia.com/b.jpg" },
      { alt: "Estúdio montado", line: 11, url: "https://img.easeia.com/c.jpg" },
    ]);
    expect(out).toBe(
      [
        "## Primeira seção",
        "",
        "Um parágrafo sobre microfones.",
        "",
        "![Um microfone](https://img.easeia.com/a.jpg)",
        "",
        "## Segunda seção",
        "",
        "Outro parágrafo sobre acústica.",
        "",
        "![Painéis acústicos](https://img.easeia.com/b.jpg)",
        "",
        "## Terceira seção",
        "",
        "Fecho do texto.",
        "",
        "![Estúdio montado](https://img.easeia.com/c.jpg)",
      ].join("\n"),
    );
  });

  it("does not let an earlier insertion shift a later target line", () => {
    const out = applyBodyImages(body, [
      { alt: "A", line: 1, url: "https://img.easeia.com/a.jpg" },
      { alt: "B", line: 9, url: "https://img.easeia.com/b.jpg" },
    ]);
    const lines = out.split("\n");
    expect(lines[lines.indexOf("![A](https://img.easeia.com/a.jpg)") - 1]).toBe("");
    expect(lines[lines.indexOf("![B](https://img.easeia.com/b.jpg)") - 2]).toBe(
      "## Terceira seção",
    );
  });

  it("separates the image from prose when the target sits mid-paragraph", () => {
    const prose = ["Primeira linha.", "Segunda linha."].join("\n");
    expect(
      applyBodyImages(prose, [{ alt: "X", line: 1, url: "https://img.easeia.com/x.jpg" }]),
    ).toBe(
      ["Primeira linha.", "", "![X](https://img.easeia.com/x.jpg)", "", "Segunda linha."].join(
        "\n",
      ),
    );
  });

  it("ignores targets outside the body", () => {
    expect(
      applyBodyImages(body, [
        { alt: "A", line: 0, url: "https://img.easeia.com/a.jpg" },
        { alt: "B", line: 99, url: "https://img.easeia.com/b.jpg" },
      ]),
    ).toBe(body);
  });

  it("strips brackets from alt text so the image markup survives", () => {
    const out = applyBodyImages("Uma linha.", [
      { alt: "Foto [1] do estúdio", line: 1, url: "https://img.easeia.com/a.jpg" },
    ]);
    expect(out).toContain("![Foto 1 do estúdio](https://img.easeia.com/a.jpg)");
  });
});
