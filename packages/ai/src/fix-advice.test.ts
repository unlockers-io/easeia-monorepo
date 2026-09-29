import { describe, expect, it } from "vitest";

import { buildFixAdvicePrompt, fixAdviceSchema } from "./fix-advice";

describe("fixAdviceSchema", () => {
  it("accepts a well-formed advice payload", () => {
    const result = fixAdviceSchema.safeParse({
      autoApplyable: false,
      category: "hosting",
      problem:
        "The server is not advertising a Content-Encoding header, so browsers receive uncompressed HTML which slows TTFB.",
      severity: "medium",
      steps: [
        {
          description: "Enable gzip in the Hostinger hPanel under Advanced > Cache.",
          manual: true,
          snippet: null,
        },
        {
          description: "Add a Brotli fallback via .htaccess.",
          manual: true,
          snippet:
            "<IfModule mod_brotli.c>\n  AddOutputFilterByType BROTLI_COMPRESS text/html\n</IfModule>",
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects a payload with too many steps", () => {
    const result = fixAdviceSchema.safeParse({
      autoApplyable: false,
      category: "hosting",
      problem: "Server is not compressing responses, which slows page load times for visitors.",
      severity: "low",
      steps: Array.from({ length: 9 }, () => ({
        description: "Some step that is long enough to pass validation.",
        manual: true,
        snippet: null,
      })),
    });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown category", () => {
    const result = fixAdviceSchema.safeParse({
      autoApplyable: false,
      category: "marketing",
      problem: "Server is not compressing responses, which slows page load times for visitors.",
      severity: "low",
      steps: [
        { description: "Enable compression in the hosting panel.", manual: true, snippet: null },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown severity", () => {
    const result = fixAdviceSchema.safeParse({
      autoApplyable: false,
      category: "hosting",
      problem: "Server is not compressing responses, which slows page load times for visitors.",
      severity: "critical",
      steps: [
        { description: "Enable compression in the hosting panel.", manual: true, snippet: null },
      ],
    });
    expect(result.success).toBe(false);
  });
});

describe("buildFixAdvicePrompt", () => {
  it("includes the check name and site context", () => {
    const prompt = buildFixAdvicePrompt({
      checkName: "is_redirect",
      site: {
        domain: "example.com",
        niches: ["WEDDING", "PHOTOGRAPHY"],
      },
    });
    expect(prompt).toContain("is_redirect");
    expect(prompt).toContain("example.com");
    expect(prompt).toContain("https://example.com");
    expect(prompt).toContain("WEDDING, PHOTOGRAPHY");
    expect(prompt).toContain("Astro");
  });

  it("renders niches as 'unspecified' when empty", () => {
    const prompt = buildFixAdvicePrompt({
      checkName: "no_content_encoding",
      site: { domain: "example.com", niches: [] },
    });
    expect(prompt).toContain("Niches: unspecified");
  });
});
