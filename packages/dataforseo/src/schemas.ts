import { z } from "zod";

const itemsOf = <Item extends z.ZodType>(item: Item) =>
  z.object({ items: z.array(item).nullish() });

const onPageMetaSchema = z.object({
  content: z.object({ plain_text_word_count: z.number().nullish() }).nullish(),
  external_links_count: z.number().nullish(),
  images_count: z.number().nullish(),
  internal_links_count: z.number().nullish(),
});

const pageTimingSchema = z.object({
  largest_contentful_paint: z.number().nullish(),
  time_to_interactive: z.number().nullish(),
});

const checksSchema = z.record(z.string(), z.boolean());

const onPageItemSchema = z.object({
  checks: checksSchema.nullish(),
  meta: onPageMetaSchema.nullish(),
  onpage_score: z.number().nullish(),
  page_timing: pageTimingSchema.nullish(),
  url: z.string().nullish(),
});

export const onPageInstantResultSchema = itemsOf(onPageItemSchema);

const organicMetricsSchema = z.object({
  count: z.number().nullish(),
  etv: z.number().nullish(),
  pos_1: z.number().nullish(),
  pos_11_20: z.number().nullish(),
  pos_2_3: z.number().nullish(),
  pos_4_10: z.number().nullish(),
});

const domainRankMetricsSchema = z.object({ organic: organicMetricsSchema.nullish() });

const domainRankItemSchema = z.object({ metrics: domainRankMetricsSchema.nullish() });

export const domainRankResultSchema = itemsOf(domainRankItemSchema);

const keywordInfoSchema = z.object({
  cpc: z.number().nullish(),
  search_volume: z.number().nullish(),
});

const keywordDataSchema = z.object({
  keyword: z.string(),
  keyword_info: keywordInfoSchema.nullish(),
});

const rankedSerpItemSchema = z.object({
  rank_absolute: z.number().nullish(),
  url: z.string().nullish(),
});

const rankedSerpElementSchema = z.object({ serp_item: rankedSerpItemSchema.nullish() });

const rankedKeywordItemSchema = z.object({
  keyword_data: keywordDataSchema.nullish(),
  ranked_serp_element: rankedSerpElementSchema.nullish(),
});

export const rankedKeywordsResultSchema = itemsOf(rankedKeywordItemSchema);

export const backlinksSummaryResultSchema = z.object({
  backlinks: z.number().nullish(),
  referring_domains: z.number().nullish(),
});

const serpOrganicItemSchema = z.object({
  description: z.string().nullish(),
  domain: z.string().nullish(),
  rank_absolute: z.number().nullish(),
  title: z.string().nullish(),
  type: z.string(),
  url: z.string().nullish(),
});

export const serpOrganicResultSchema = itemsOf(serpOrganicItemSchema);
