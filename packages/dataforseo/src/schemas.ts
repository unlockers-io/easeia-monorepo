/**
 * DataForSEO response schemas: partial models, only the fields the
 * public methods consume. The vendor returns much more; we strip it
 * down to keep parsing cheap and refactors painless.
 */
import { z } from "zod";

const taskEnvelope = <T extends z.ZodType>(resultRow: T) => {
  const result = z.array(resultRow).nullable().optional();
  const task = z.object({ result });
  return z.object({ tasks: z.array(task) });
};

const onPageContentSchema = z.object({
  automated_readability_index: z.number().nullable().optional(),
  flesch_kincaid_readability_index: z.number().nullable().optional(),
  plain_text_size: z.number().nullable().optional(),
  plain_text_word_count: z.number().nullable().optional(),
});

const htagsSchema = z.record(z.string(), z.array(z.string()));

const onPageMetaSchema = z.object({
  content: onPageContentSchema.partial().optional(),
  description: z.string().nullable().optional(),
  external_links_count: z.number().nullable().optional(),
  htags: htagsSchema.optional(),
  images_count: z.number().nullable().optional(),
  internal_links_count: z.number().nullable().optional(),
  title: z.string().nullable().optional(),
});

const onPagePageTimingSchema = z.object({
  dom_complete: z.number().nullable().optional(),
  first_input_delay: z.number().nullable().optional(),
  largest_contentful_paint: z.number().nullable().optional(),
  time_to_interactive: z.number().nullable().optional(),
});

const onPageItemSchema = z.object({
  checks: z.record(z.string(), z.boolean()).optional(),
  meta: onPageMetaSchema.partial().optional(),
  onpage_score: z.number().nullable().optional(),
  page_timing: onPagePageTimingSchema.partial().optional(),
  total_dom_size: z.number().nullable().optional(),
  url: z.string().optional(),
});

const onPageResultSchema = z.object({
  crawl_progress: z.string().optional(),
  items: z.array(onPageItemSchema).nullable().optional(),
});

export const onPageInstantSchema = taskEnvelope(onPageResultSchema);

const organicMetricsSchema = z.object({
  count: z.number().optional(),
  etv: z.number().optional(),
  impressions_etv: z.number().optional(),
  pos_1: z.number().optional(),
  pos_11_20: z.number().optional(),
  pos_2_3: z.number().optional(),
  pos_4_10: z.number().optional(),
});

const paidMetricsSchema = z.object({
  count: z.number().optional(),
  etv: z.number().optional(),
});

const domainRankMetricsSchema = z.object({
  organic: organicMetricsSchema.partial().optional(),
  paid: paidMetricsSchema.partial().optional(),
});

const domainRankItemSchema = z.object({
  metrics: domainRankMetricsSchema.partial().optional(),
  target: z.string().optional(),
});

const domainRankResultSchema = z.object({
  items: z.array(domainRankItemSchema).nullable().optional(),
});

export const domainRankSchema = taskEnvelope(domainRankResultSchema);

const keywordInfoSchema = z.object({
  competition: z.number().nullable().optional(),
  cpc: z.number().nullable().optional(),
  search_volume: z.number().nullable().optional(),
});

const keywordDataSchema = z.object({
  keyword: z.string(),
  keyword_info: keywordInfoSchema.partial().optional(),
});

const rankedSerpItemSchema = z.object({
  rank_absolute: z.number().optional(),
  rank_group: z.number().optional(),
  title: z.string().optional(),
  url: z.string().optional(),
});

const rankedSerpElementSchema = z.object({
  serp_item: rankedSerpItemSchema.partial().optional(),
});

const rankedKeywordItemSchema = z.object({
  keyword_data: keywordDataSchema.optional(),
  ranked_serp_element: rankedSerpElementSchema.optional(),
});

const rankedKeywordsResultSchema = z.object({
  items: z.array(rankedKeywordItemSchema).nullable().optional(),
});

export const rankedKeywordsSchema = taskEnvelope(rankedKeywordsResultSchema);

const backlinksSummaryResultSchema = z.object({
  backlinks: z.number().optional(),
  broken_backlinks: z.number().optional(),
  broken_pages: z.number().optional(),
  crawl_progress: z.string().optional(),
  referring_domains: z.number().optional(),
  referring_domains_nofollow: z.number().optional(),
  referring_main_domains: z.number().optional(),
  referring_pages: z.number().optional(),
  referring_pages_nofollow: z.number().optional(),
  target: z.string().optional(),
});

export const backlinksSummarySchema = taskEnvelope(backlinksSummaryResultSchema);

const serpOrganicItemSchema = z.object({
  description: z.string().nullable().optional(),
  domain: z.string().optional(),
  rank_absolute: z.number().optional(),
  rank_group: z.number().optional(),
  title: z.string().optional(),
  type: z.string().optional(),
  url: z.string().optional(),
});

const serpOrganicResultSchema = z.object({
  items: z.array(serpOrganicItemSchema).nullable().optional(),
});

export const serpOrganicSchema = taskEnvelope(serpOrganicResultSchema);
