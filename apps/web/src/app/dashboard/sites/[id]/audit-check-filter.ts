/**
 * DataForSEO checks are assertions: `no_description: true` is an issue,
 * `is_https: true` is the good state.
 */
const NOISE: ReadonlySet<string> = new Set([
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

/**
 * Checks where `true` means the page is in the good state. Everything
 * else is an issue flag (`true` = problem present).
 */
const POSITIVE_ASSERTIONS: ReadonlySet<string> = new Set([
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

export const onPageCheckPassed = (name: string, value: boolean): boolean => {
  return POSITIVE_ASSERTIONS.has(name) ? value : !value;
};

export const partitionFailingChecks = (failing: ReadonlyArray<readonly [string, boolean]>) => {
  const actionable: Array<string> = [];
  const suppressed: Array<string> = [];
  for (const [name] of failing) {
    if (NOISE.has(name)) {
      suppressed.push(name);
    } else {
      actionable.push(name);
    }
  }
  return { actionable, suppressed };
};
