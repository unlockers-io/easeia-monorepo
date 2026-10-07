const PASSES_WHEN_TRUE: ReadonlySet<string> = new Set([
  "cachable",
  "canonical",
  "follow",
  "from_sitemap",
  "has_html_doctype",
  "has_meta_title",
  "has_micromarkup",
  "is_https",
  "meta_charset_consistency",
  "seo_friendly_url",
  "seo_friendly_url_characters_check",
  "seo_friendly_url_dynamic_check",
  "seo_friendly_url_keywords_check",
  "seo_friendly_url_relative_length_check",
]);

const NOT_ACTIONABLE: ReadonlySet<string> = new Set([
  "deprecated_html_tags",
  "duplicate_meta_tags",
  "flash",
  "frame",
  "from_sitemap",
  "has_meta_refresh_redirect",
  "has_meta_title",
  "has_micromarkup",
  "has_micromarkup_errors",
  "has_render_blocking_resources",
  "high_character_count",
  "high_content_rate",
  "high_loading_time",
  "high_waiting_time",
  "https_to_http_links",
  "irrelevant_meta_keywords",
  "is_4xx_code",
  "is_5xx_code",
  "is_broken",
  "is_http",
  "is_redirect",
  "is_www",
  "large_page_size",
  "lorem_ipsum",
  "meta_charset_consistency",
  "no_content_encoding",
  "no_doctype",
  "no_encoding_meta_tag",
  "no_favicon",
  "no_h1_tag",
  "no_image_title",
  "size_greater_than_3mb",
  "small_page_size",
]);

const FAILURE_LABELS: ReadonlyMap<string, string> = new Map([
  ["canonical", "Canonical link"],
  ["duplicate_description", "Duplicate meta description"],
  ["duplicate_meta_tags", "Duplicate meta tags"],
  ["duplicate_title_tag", "Duplicate title"],
  ["high_loading_time", "Slow page load"],
  ["irrelevant_description", "Description doesn't match content"],
  ["irrelevant_meta_keywords", "Meta keywords irrelevant"],
  ["irrelevant_title", "Title doesn't match content"],
  ["is_4xx_code", "4xx response"],
  ["is_5xx_code", "5xx response"],
  ["is_broken", "Broken page"],
  ["is_https", "HTTPS"],
  ["is_redirect", "Redirect"],
  ["no_content_encoding", "Missing content encoding"],
  ["no_description", "Missing meta description"],
  ["no_doctype", "Missing doctype"],
  ["no_favicon", "Missing favicon"],
  ["no_h1_tag", "Missing H1"],
  ["no_image_alt", "Images missing alt"],
  ["no_image_title", "Images missing title"],
  ["no_title", "Missing title"],
  ["seo_friendly_url", "SEO-unfriendly URL"],
  ["small_page_size", "Page too small"],
  ["title_too_long", "Title too long"],
  ["title_too_short", "Title too short"],
]);

export type FailedCheck = {
  actionable: boolean;
  label: string;
  name: string;
};

export type AuditChecks = {
  failed: ReadonlyArray<FailedCheck>;
  passed: number;
};

export const summarizeChecks = (checks: Readonly<Record<string, boolean>>): AuditChecks => {
  const failed = Object.entries(checks).flatMap(([name, value]) =>
    PASSES_WHEN_TRUE.has(name) === value
      ? []
      : [{ actionable: !NOT_ACTIONABLE.has(name), label: FAILURE_LABELS.get(name) ?? name, name }],
  );
  return { failed, passed: Object.keys(checks).length - failed.length };
};
