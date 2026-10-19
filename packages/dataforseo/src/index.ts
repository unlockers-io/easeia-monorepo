import { type AuditChecks, summarizeChecks } from "./checks";
import { createRequest, stripScheme, type Transport } from "./client";
import { type MarketSite, marketName, marketParams } from "./market";
import {
  backlinksSummaryResultSchema,
  domainRankResultSchema,
  onPageInstantResultSchema,
  rankedKeywordsResultSchema,
  serpOrganicResultSchema,
} from "./schemas";

export { DataForSeoNotConfiguredError, isDataForSeoConfigured } from "./credentials";
export { DataForSeoError } from "./error";

type PageAudit = {
  checks: AuditChecks;
  externalLinks: number | null;
  imagesCount: number | null;
  internalLinks: number | null;
  largestContentfulPaintMs: number | null;
  onpageScore: number | null;
  timeToInteractiveMs: number | null;
  url: string;
  wordCount: number | null;
};

type DomainRankOverview = {
  organicKeywords: number;
  organicTraffic: number;
  pos1: number;
  pos11to20: number;
  pos2to3: number;
  pos4to10: number;
};

type RankedKeyword = {
  cpc: number | null;
  keyword: string;
  rank: number;
  searchVolume: number | null;
  url: string | null;
};

type BacklinkSummary = {
  backlinks: number;
  referringDomains: number;
};

type SerpPosition = {
  description: string | null;
  domain: string;
  rank: number;
  title: string;
  url: string;
};

type SerpResult = {
  market: string;
  matched: SerpPosition | null;
  top: Array<SerpPosition>;
};

const SERP_DEPTH = 20;

const isText = (value: string | null | undefined): value is string =>
  typeof value === "string" && value !== "";

const bareHost = (urlOrDomain: string): string =>
  stripScheme(urlOrDomain)
    .replace(/^www\./v, "")
    .toLowerCase();

export const createDataForSeo = (transport: Transport) => {
  const request = createRequest(transport);

  const auditPage = async (url: string): Promise<PageAudit | null> => {
    const result = await request(
      "/v3/on_page/instant_pages",
      [{ enable_javascript: false, enable_xhr: false, load_resources: false, url }],
      onPageInstantResultSchema,
    );
    const item = result?.items?.[0];
    if (!item) {
      return null;
    }
    return {
      checks: summarizeChecks(item.checks ?? {}),
      externalLinks: item.meta?.external_links_count ?? null,
      imagesCount: item.meta?.images_count ?? null,
      internalLinks: item.meta?.internal_links_count ?? null,
      largestContentfulPaintMs: item.page_timing?.largest_contentful_paint ?? null,
      onpageScore: item.onpage_score ?? null,
      timeToInteractiveMs: item.page_timing?.time_to_interactive ?? null,
      url: item.url ?? url,
      wordCount: item.meta?.content?.plain_text_word_count ?? null,
    };
  };

  const domainRankOverview = async (site: MarketSite): Promise<DomainRankOverview | null> => {
    const result = await request(
      "/v3/dataforseo_labs/google/domain_rank_overview/live",
      [{ ...marketParams(site.language), target: stripScheme(site.domain) }],
      domainRankResultSchema,
    );
    const item = result?.items?.[0];
    if (!item) {
      return null;
    }
    const organic = item.metrics?.organic;
    return {
      organicKeywords: organic?.count ?? 0,
      organicTraffic: organic?.etv ?? 0,
      pos1: organic?.pos_1 ?? 0,
      pos11to20: organic?.pos_11_20 ?? 0,
      pos2to3: organic?.pos_2_3 ?? 0,
      pos4to10: organic?.pos_4_10 ?? 0,
    };
  };

  const rankedKeywords = async (site: MarketSite, limit: number): Promise<Array<RankedKeyword>> => {
    const result = await request(
      "/v3/dataforseo_labs/google/ranked_keywords/live",
      [
        {
          ...marketParams(site.language),
          limit,
          order_by: ["ranked_serp_element.serp_item.rank_absolute,asc"],
          target: stripScheme(site.domain),
        },
      ],
      rankedKeywordsResultSchema,
    );
    return (result?.items ?? []).map((item) => ({
      cpc: item.keyword_data?.keyword_info?.cpc ?? null,
      keyword: item.keyword_data?.keyword ?? "",
      rank: item.ranked_serp_element?.serp_item?.rank_absolute ?? 0,
      searchVolume: item.keyword_data?.keyword_info?.search_volume ?? null,
      url: item.ranked_serp_element?.serp_item?.url ?? null,
    }));
  };

  const backlinkSummary = async (domain: string): Promise<BacklinkSummary | null> => {
    const result = await request(
      "/v3/backlinks/summary/live",
      [{ target: stripScheme(domain) }],
      backlinksSummaryResultSchema,
    );
    if (!result) {
      return null;
    }
    return {
      backlinks: result.backlinks ?? 0,
      referringDomains: result.referring_domains ?? 0,
    };
  };

  const serpOrganic = async (site: MarketSite, keyword: string): Promise<SerpResult> => {
    const result = await request(
      "/v3/serp/google/organic/live/regular",
      [{ ...marketParams(site.language), depth: SERP_DEPTH, keyword }],
      serpOrganicResultSchema,
    );
    const top = (result?.items ?? []).flatMap((item) =>
      item.type === "organic" && isText(item.url) && isText(item.title)
        ? [
            {
              description: item.description ?? null,
              domain: (item.domain ?? "").toLowerCase(),
              rank: item.rank_absolute ?? 0,
              title: item.title,
              url: item.url,
            },
          ]
        : [],
    );
    const target = bareHost(site.domain);
    return {
      market: marketName(site.language),
      matched: top.find((p) => bareHost(p.domain) === target) ?? null,
      top,
    };
  };

  return { auditPage, backlinkSummary, domainRankOverview, rankedKeywords, serpOrganic };
};

export const dataForSeo = createDataForSeo({
  fetch: (url, init) => fetch(url, init),
  timeoutMs: 30_000,
});
