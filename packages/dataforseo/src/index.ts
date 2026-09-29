import { request, stripScheme } from "./client";
import {
  backlinksSummarySchema,
  domainRankSchema,
  onPageInstantSchema,
  rankedKeywordsSchema,
  serpOrganicSchema,
} from "./schemas";

export { DataForSeoError, DataForSeoNotConfiguredError, isDataForSeoConfigured } from "./client";

export type OnPageInstantResult = {
  checks: Record<string, boolean>;
  description: string | null;
  externalLinks: number | null;
  hCounts: Record<string, number>;
  imagesCount: number | null;
  internalLinks: number | null;
  largestContentfulPaintMs: number | null;
  onpageScore: number | null;
  timeToInteractiveMs: number | null;
  title: string | null;
  url: string;
  wordCount: number | null;
};

export const auditPage = async (url: string): Promise<OnPageInstantResult | null> => {
  const json = await request({
    body: [
      {
        enable_javascript: false,
        enable_xhr: false,
        load_resources: false,
        url,
      },
    ],
    path: "/v3/on_page/instant_pages",
    schema: onPageInstantSchema,
  });
  const item = json.tasks[0]?.result?.[0]?.items?.[0];
  if (!item) {
    return null;
  }
  const hCounts: Record<string, number> = {};
  for (const [tag, list] of Object.entries(item.meta?.htags ?? {})) {
    hCounts[tag] = list.length;
  }
  return {
    checks: item.checks ?? {},
    description: item.meta?.description ?? null,
    externalLinks: item.meta?.external_links_count ?? null,
    hCounts,
    imagesCount: item.meta?.images_count ?? null,
    internalLinks: item.meta?.internal_links_count ?? null,
    largestContentfulPaintMs: item.page_timing?.largest_contentful_paint ?? null,
    onpageScore: item.onpage_score ?? null,
    timeToInteractiveMs: item.page_timing?.time_to_interactive ?? null,
    title: item.meta?.title ?? null,
    url: item.url ?? url,
    wordCount: item.meta?.content?.plain_text_word_count ?? null,
  };
};

export type DomainRankOverview = {
  organicKeywords: number;
  organicTrafficValue: number;
  pos1: number;
  pos11to20: number;
  pos2to3: number;
  pos4to10: number;
  target: string;
};

export const domainRankOverview = async (
  domain: string,
  locationCode = 2840,
  languageCode = "en",
): Promise<DomainRankOverview | null> => {
  const json = await request({
    body: [
      { language_code: languageCode, location_code: locationCode, target: stripScheme(domain) },
    ],
    path: "/v3/dataforseo_labs/google/domain_rank_overview/live",
    schema: domainRankSchema,
  });
  const item = json.tasks[0]?.result?.[0]?.items?.[0];
  if (!item) {
    return null;
  }
  return {
    organicKeywords: item.metrics?.organic?.count ?? 0,
    organicTrafficValue: item.metrics?.organic?.etv ?? 0,
    pos1: item.metrics?.organic?.pos_1 ?? 0,
    pos11to20: item.metrics?.organic?.pos_11_20 ?? 0,
    pos2to3: item.metrics?.organic?.pos_2_3 ?? 0,
    pos4to10: item.metrics?.organic?.pos_4_10 ?? 0,
    target: item.target ?? domain,
  };
};

export type RankedKeyword = {
  competition: number | null;
  cpc: number | null;
  keyword: string;
  rank: number;
  searchVolume: number | null;
  url: string | null;
};

export const rankedKeywords = async (
  domain: string,
  limit = 20,
  locationCode = 2840,
  languageCode = "en",
): Promise<Array<RankedKeyword>> => {
  const json = await request({
    body: [
      {
        language_code: languageCode,
        limit,
        location_code: locationCode,
        order_by: ["ranked_serp_element.serp_item.rank_absolute,asc"],
        target: stripScheme(domain),
      },
    ],
    path: "/v3/dataforseo_labs/google/ranked_keywords/live",
    schema: rankedKeywordsSchema,
  });
  const items = json.tasks[0]?.result?.[0]?.items ?? [];
  return items.map((item) => ({
    competition: item.keyword_data?.keyword_info?.competition ?? null,
    cpc: item.keyword_data?.keyword_info?.cpc ?? null,
    keyword: item.keyword_data?.keyword ?? "",
    rank: item.ranked_serp_element?.serp_item?.rank_absolute ?? 0,
    searchVolume: item.keyword_data?.keyword_info?.search_volume ?? null,
    url: item.ranked_serp_element?.serp_item?.url ?? null,
  }));
};

export type BacklinkSummary = {
  backlinks: number;
  brokenBacklinks: number;
  brokenPages: number;
  referringDomains: number;
  referringMainDomains: number;
  referringPages: number;
  target: string;
};

export const backlinkSummary = async (domain: string): Promise<BacklinkSummary | null> => {
  const json = await request({
    body: [{ target: stripScheme(domain) }],
    path: "/v3/backlinks/summary/live",
    schema: backlinksSummarySchema,
  });
  const item = json.tasks[0]?.result?.[0];
  if (!item) {
    return null;
  }
  return {
    backlinks: item.backlinks ?? 0,
    brokenBacklinks: item.broken_backlinks ?? 0,
    brokenPages: item.broken_pages ?? 0,
    referringDomains: item.referring_domains ?? 0,
    referringMainDomains: item.referring_main_domains ?? 0,
    referringPages: item.referring_pages ?? 0,
    target: item.target ?? domain,
  };
};

export type SerpPosition = {
  description: string | null;
  domain: string;
  rank: number;
  title: string;
  url: string;
};

export type SerpResult = {
  matched: SerpPosition | null;
  top: Array<SerpPosition>;
};

export const serpOrganic = async (
  keyword: string,
  targetDomain: string,
  locationCode = 2840,
  languageCode = "en",
): Promise<SerpResult> => {
  const json = await request({
    body: [
      {
        depth: 20,
        keyword,
        language_code: languageCode,
        location_code: locationCode,
      },
    ],
    path: "/v3/serp/google/organic/live/regular",
    schema: serpOrganicSchema,
  });
  const items = json.tasks[0]?.result?.[0]?.items ?? [];
  const target = stripScheme(targetDomain)
    .replace(/^www\./v, "")
    .toLowerCase();
  const top = items.flatMap((item) => {
    const isOrganicResult =
      item.type === "organic" &&
      item.url !== undefined &&
      item.url !== "" &&
      item.title !== undefined &&
      item.title !== "";
    return isOrganicResult
      ? [
          {
            description: item.description ?? null,
            domain: (item.domain ?? "").toLowerCase(),
            rank: item.rank_absolute ?? 0,
            title: item.title ?? "",
            url: item.url ?? "",
          },
        ]
      : [];
  });
  const matched = top.find((p) => p.domain.replace(/^www\./v, "") === target) ?? null;
  return { matched, top };
};
