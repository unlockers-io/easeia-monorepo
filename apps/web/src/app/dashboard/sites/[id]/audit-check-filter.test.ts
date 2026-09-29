import { describe, expect, it } from "vitest";

import { onPageCheckPassed, partitionFailingChecks } from "./audit-check-filter";

describe("onPageCheckPassed", () => {
  it("treats issue flags as failing only when true", () => {
    expect(onPageCheckPassed("no_description", true)).toBe(false);
    expect(onPageCheckPassed("no_description", false)).toBe(true);
    expect(onPageCheckPassed("title_too_short", true)).toBe(false);
    expect(onPageCheckPassed("title_too_short", false)).toBe(true);
    expect(onPageCheckPassed("no_image_alt", false)).toBe(true);
    expect(onPageCheckPassed("duplicate_title_tag", false)).toBe(true);
    expect(onPageCheckPassed("irrelevant_title", false)).toBe(true);
  });

  it("treats positive assertions as passing when true", () => {
    expect(onPageCheckPassed("is_https", true)).toBe(true);
    expect(onPageCheckPassed("is_https", false)).toBe(false);
    expect(onPageCheckPassed("has_meta_title", true)).toBe(true);
    expect(onPageCheckPassed("has_meta_title", false)).toBe(false);
    expect(onPageCheckPassed("from_sitemap", true)).toBe(true);
    expect(onPageCheckPassed("from_sitemap", false)).toBe(false);
    expect(onPageCheckPassed("seo_friendly_url", true)).toBe(true);
  });
});

describe("partitionFailingChecks", () => {
  it("hides cosmetic / infra / instant-pages-noise flags", () => {
    const { actionable, suppressed } = partitionFailingChecks([
      ["no_description", true],
      ["from_sitemap", false],
      ["has_meta_title", false],
      ["no_image_alt", true],
      ["is_redirect", true],
    ]);
    expect(actionable).toEqual(["no_description", "no_image_alt"]);
    expect(suppressed).toEqual(["from_sitemap", "has_meta_title", "is_redirect"]);
  });
});
