import { describe, expect, it } from "vitest";

import {
  buildBodyImagePlanPrompt,
  MAX_BODY_IMAGES,
  sanitizeBodyImagePlan,
} from "./plan-body-images";

// Targets below are 1-based line numbers: array index + 1. Lines 5-7 are fenced.
const body = [
  "## Microfones",
  "",
  "Um parágrafo.",
  "",
  "```bash",
  "arecord -l",
  "```",
  "",
  "Fecho.",
].join("\n");

const image = (
  line: number,
  alt = "Alt",
  prompt = "A studio scene with gear",
): {
  alt: string;
  line: number;
  prompt: string;
} => ({ alt, line, prompt });

describe("buildBodyImagePlanPrompt", () => {
  it("numbers every body line so the model can reference them", () => {
    const prompt = buildBodyImagePlanPrompt({
      body,
      post: { tags: ["audio"], title: "Guia de Microfones" },
      site: { language: "PT" },
    });
    expect(prompt).toContain("1| ## Microfones");
    expect(prompt).toContain("9| Fecho.");
    expect(prompt).toContain("Guia de Microfones");
    expect(prompt).toContain("Tags: audio");
  });

  it("asks for alt text in the site's language", () => {
    const pt = buildBodyImagePlanPrompt({
      body,
      post: { tags: [], title: "T" },
      site: { language: "PT" },
    });
    const es = buildBodyImagePlanPrompt({
      body,
      post: { tags: [], title: "T" },
      site: { language: "ES" },
    });
    expect(pt).toContain("Portuguese (Brazil)");
    expect(es).toContain("Spanish (Spain)");
    expect(pt).not.toContain("Tags:");
  });
});

describe("sanitizeBodyImagePlan", () => {
  it("keeps valid targets in ascending line order", () => {
    expect(sanitizeBodyImagePlan(body, [image(9), image(3)])).toEqual([
      { alt: "Alt", line: 3, prompt: "A studio scene with gear" },
      { alt: "Alt", line: 9, prompt: "A studio scene with gear" },
    ]);
  });

  it("drops lines outside the body", () => {
    expect(sanitizeBodyImagePlan(body, [image(0), image(10), image(-3)])).toEqual([]);
  });

  it("drops duplicated lines, keeping one", () => {
    expect(sanitizeBodyImagePlan(body, [image(3), image(3)])).toHaveLength(1);
  });

  it("drops targets inside a fenced code block, fences included", () => {
    expect(sanitizeBodyImagePlan(body, [image(5), image(6), image(7)])).toEqual([]);
  });

  it("drops entries with empty alt or prompt", () => {
    expect(sanitizeBodyImagePlan(body, [image(3, "   "), image(9, "Alt", "  ")])).toEqual([]);
  });

  it(`caps the plan at ${MAX_BODY_IMAGES} images`, () => {
    const long = Array.from({ length: 30 }, (_, i) => `Linha ${i + 1}.`).join("\n");
    const plan = sanitizeBodyImagePlan(
      long,
      Array.from({ length: 10 }, (_, i) => image(i + 1)),
    );
    expect(plan).toHaveLength(MAX_BODY_IMAGES);
  });

  it("trims whitespace off what the model returned", () => {
    expect(sanitizeBodyImagePlan(body, [image(3, "  Alt  ", "  A studio scene  ")])).toEqual([
      { alt: "Alt", line: 3, prompt: "A studio scene" },
    ]);
  });
});
