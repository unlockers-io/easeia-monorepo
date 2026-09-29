import { describe, expect, it } from "vitest";

import { seoSuggestionSchema } from "./seo";

describe("seoSuggestionSchema", () => {
  it("accepts a well-formed suggestion", () => {
    const result = seoSuggestionSchema.safeParse({
      description:
        "A 140-character meta description that explains the post and ends on a verb-driven hook for clicks.",
      focusKeyword: "wedding photography",
      rationale: "Tightens the title and pushes the focus keyword toward the front of the line.",
      title: "Wedding photography pricing guide",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a SEO title that is too short", () => {
    const result = seoSuggestionSchema.safeParse({
      description: "x".repeat(140),
      focusKeyword: "wedding",
      rationale: "ok rationale here that is long enough.",
      title: "short",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a SEO title over 60 characters", () => {
    const result = seoSuggestionSchema.safeParse({
      description: "x".repeat(140),
      focusKeyword: "wedding",
      rationale: "ok rationale here that is long enough.",
      title: "x".repeat(61),
    });
    expect(result.success).toBe(false);
  });

  it("rejects a meta description that exceeds the cap", () => {
    const result = seoSuggestionSchema.safeParse({
      description: "x".repeat(161),
      focusKeyword: "wedding",
      rationale: "ok rationale here that is long enough.",
      title: "Wedding photography pricing guide",
    });
    expect(result.success).toBe(false);
  });
});
