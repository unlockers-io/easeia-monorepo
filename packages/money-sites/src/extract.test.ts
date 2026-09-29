import { describe, expect, it } from "vitest";

import { extractVisibleText } from "./extract";

describe("extractVisibleText", () => {
  it("returns text from headings, paragraphs, and list items", () => {
    const html = `<!doctype html><html><body>
      <header><nav>nav text</nav></header>
      <main>
        <h1>Main heading</h1>
        <p>Paragraph one.</p>
        <ul><li>Item A</li><li>Item B</li></ul>
        <p>Paragraph two.</p>
      </main>
      <footer>footer text</footer>
      <script>window.__hidden = true;</script>
      <style>body { color: red; }</style>
    </body></html>`;
    const text = extractVisibleText(html);
    expect(text).toContain("Main heading");
    expect(text).toContain("Paragraph one.");
    expect(text).toContain("Item A");
    expect(text).toContain("Item B");
    expect(text).toContain("Paragraph two.");
    expect(text).not.toContain("__hidden");
    expect(text).not.toContain("color: red");
  });

  it("handles documents with no main element", () => {
    const html = `<!doctype html><html><body><p>Hello</p></body></html>`;
    expect(extractVisibleText(html)).toContain("Hello");
  });
});
