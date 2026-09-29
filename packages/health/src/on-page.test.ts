import { describe, expect, it } from "vitest";

import {
  classifyDescriptionLength,
  classifyTitleLength,
  onPageIssuesForPost,
  SEO_DESCRIPTION_MAX,
  SEO_DESCRIPTION_MIN,
  SEO_TITLE_MAX,
  SEO_TITLE_MIN,
  summarizeOnPage,
} from "./on-page";

describe("classifyTitleLength", () => {
  it("flags empty or whitespace titles as missing", () => {
    expect(classifyTitleLength("")).toBe("missing");
    expect(classifyTitleLength("   ")).toBe("missing");
  });

  it("flags titles under the Ahrefs minimum", () => {
    expect(classifyTitleLength("x".repeat(SEO_TITLE_MIN - 1))).toBe("too_short");
  });

  it("flags titles over the Ahrefs maximum", () => {
    expect(classifyTitleLength("x".repeat(SEO_TITLE_MAX + 1))).toBe("too_long");
  });

  it("accepts titles on the inclusive bounds", () => {
    expect(classifyTitleLength("x".repeat(SEO_TITLE_MIN))).toBe("ok");
    expect(classifyTitleLength("x".repeat(SEO_TITLE_MAX))).toBe("ok");
  });
});

describe("classifyDescriptionLength", () => {
  it("flags null, undefined, and blank excerpts as missing", () => {
    expect(classifyDescriptionLength(null)).toBe("missing");
    expect(classifyDescriptionLength(undefined)).toBe("missing");
    expect(classifyDescriptionLength("")).toBe("missing");
    expect(classifyDescriptionLength("   ")).toBe("missing");
  });

  it("flags excerpts under the Ahrefs minimum", () => {
    expect(classifyDescriptionLength("x".repeat(SEO_DESCRIPTION_MIN - 1))).toBe("too_short");
  });

  it("flags excerpts over the Ahrefs maximum", () => {
    expect(classifyDescriptionLength("x".repeat(SEO_DESCRIPTION_MAX + 1))).toBe("too_long");
  });

  it("accepts excerpts on the inclusive bounds", () => {
    expect(classifyDescriptionLength("x".repeat(SEO_DESCRIPTION_MIN))).toBe("ok");
    expect(classifyDescriptionLength("x".repeat(SEO_DESCRIPTION_MAX))).toBe("ok");
  });
});

describe("onPageIssuesForPost", () => {
  it("returns no issues for a healthy post", () => {
    expect(
      onPageIssuesForPost({
        excerpt: "x".repeat(140),
        inboundInternal: 2,
        title: "x".repeat(50),
      }),
    ).toEqual([]);
  });

  it("stacks every failing check on a sparse post", () => {
    expect(
      onPageIssuesForPost({
        excerpt: null,
        inboundInternal: 0,
        title: "Hi",
      }),
    ).toEqual(["title_too_short", "description_too_short", "no_inbound_internal"]);
  });
});

describe("summarizeOnPage", () => {
  it("returns zeros for an empty list", () => {
    expect(summarizeOnPage([])).toEqual({
      descriptionTooLong: 0,
      descriptionTooShort: 0,
      noInboundInternal: 0,
      published: 0,
      titleTooLong: 0,
      titleTooShort: 0,
    });
  });

  it("counts each issue independently across posts", () => {
    const counts = summarizeOnPage([
      { excerpt: "x".repeat(140), inboundInternal: 1, title: "x".repeat(50) },
      { excerpt: "short", inboundInternal: 0, title: "x".repeat(70) },
      { excerpt: "x".repeat(200), inboundInternal: 0, title: "Too short" },
    ]);
    expect(counts).toEqual({
      descriptionTooLong: 1,
      descriptionTooShort: 1,
      noInboundInternal: 2,
      published: 3,
      titleTooLong: 1,
      titleTooShort: 1,
    });
  });
});
