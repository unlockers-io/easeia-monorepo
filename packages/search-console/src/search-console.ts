import { searchconsole, type searchconsole_v1 } from "@googleapis/searchconsole";

import { authedClient } from "./tokens";

type Ctx = {
  redirectUri: string;
  userId: string;
};

const sc = async (ctx: Ctx): Promise<searchconsole_v1.Searchconsole> => {
  const auth = await authedClient(ctx);
  return searchconsole({ auth, version: "v1" });
};

type SearchConsoleClient = {
  searchanalytics: {
    query: searchconsole_v1.Searchconsole["searchanalytics"]["query"];
  };
  sites: {
    list: searchconsole_v1.Searchconsole["sites"]["list"];
  };
  urlInspection: {
    index: {
      inspect: searchconsole_v1.Searchconsole["urlInspection"]["index"]["inspect"];
    };
  };
};

type GetSearchConsoleClient = (ctx: Ctx) => Promise<SearchConsoleClient>;

type SearchAnalyticsTotals = {
  clicks: number;
  ctr: number;
  impressions: number;
  position: number;
};

type TopQuery = {
  clicks: number;
  ctr: number;
  impressions: number;
  position: number;
  query: string;
};

type TopPage = {
  clicks: number;
  ctr: number;
  impressions: number;
  page: string;
  position: number;
};

type UrlInspectionResult = {
  coverageState: string | null;
  referringUrls: ReadonlyArray<string>;
};

type PagePerformance = {
  clicks: number;
  ctr: number;
  impressions: number;
  position: number;
};

export type VerifiedSite = {
  permission: string;
  siteUrl: string;
};

const candidateSiteUrls = (domain: string): Array<string> => {
  const bare = domain.replace(/^https?:\/\//v, "").replace(/\/$/v, "");
  return [`sc-domain:${bare}`, `https://${bare}/`, `http://${bare}/`];
};

const isoDay = (date: Date): string => date.toISOString().slice(0, 10);

type DateRangeResultContract = { endDate: string; startDate: string };

const dateRange = (days: number): DateRangeResultContract => {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - days);
  return { endDate: isoDay(end), startDate: isoDay(start) };
};

const createSearchConsoleOperations = (getClient: GetSearchConsoleClient) => {
  const listVerifiedSites = async (ctx: Ctx): Promise<Array<VerifiedSite>> => {
    const client = await getClient(ctx);
    const res = await client.sites.list();
    const entries = res.data.siteEntry ?? [];
    return entries
      .filter(
        (s): s is { permissionLevel: string; siteUrl: string } =>
          typeof s.siteUrl === "string" &&
          s.siteUrl !== "" &&
          typeof s.permissionLevel === "string" &&
          s.permissionLevel !== "",
      )
      .map((s) => ({ permission: s.permissionLevel, siteUrl: s.siteUrl }));
  };

  const resolveSiteUrl = async (ctx: Ctx, domain: string): Promise<string | null> => {
    const verified = await listVerifiedSites(ctx);
    const verifiedSet = new Set(verified.map((v) => v.siteUrl));
    for (const candidate of candidateSiteUrls(domain)) {
      if (verifiedSet.has(candidate)) {
        return candidate;
      }
    }
    return null;
  };

  // A missing row must stay null because position 0 would incorrectly improve
  // the health score.
  const totals = async (
    ctx: Ctx,
    siteUrl: string,
    days: number,
  ): Promise<SearchAnalyticsTotals | null> => {
    const client = await getClient(ctx);
    const res = await client.searchanalytics.query({
      requestBody: { ...dateRange(days), rowLimit: 1 },
      siteUrl,
    });
    const row = res.data.rows?.[0];
    if (!row) {
      return null;
    }
    return {
      clicks: row.clicks ?? 0,
      ctr: row.ctr ?? 0,
      impressions: row.impressions ?? 0,
      position: row.position ?? 0,
    };
  };

  const topQueries = async (
    ctx: Ctx,
    siteUrl: string,
    params: { days: number; limit: number },
  ): Promise<Array<TopQuery>> => {
    const client = await getClient(ctx);
    const res = await client.searchanalytics.query({
      requestBody: {
        ...dateRange(params.days),
        dimensions: ["query"],
        rowLimit: params.limit,
      },
      siteUrl,
    });
    const rows = res.data.rows ?? [];
    const out: Array<TopQuery> = [];
    for (const r of rows) {
      const query = r.keys?.[0];
      if (query === undefined || query === "") {
        continue;
      }
      out.push({
        clicks: r.clicks ?? 0,
        ctr: r.ctr ?? 0,
        impressions: r.impressions ?? 0,
        position: r.position ?? 0,
        query,
      });
    }
    return out;
  };

  const topPages = async (
    ctx: Ctx,
    siteUrl: string,
    params: { days: number; limit: number },
  ): Promise<Array<TopPage>> => {
    const client = await getClient(ctx);
    const res = await client.searchanalytics.query({
      requestBody: {
        ...dateRange(params.days),
        dimensions: ["page"],
        rowLimit: params.limit,
      },
      siteUrl,
    });
    const rows = res.data.rows ?? [];
    const out: Array<TopPage> = [];
    for (const r of rows) {
      const page = r.keys?.[0];
      if (page === undefined || page === "") {
        continue;
      }
      out.push({
        clicks: r.clicks ?? 0,
        ctr: r.ctr ?? 0,
        impressions: r.impressions ?? 0,
        page,
        position: r.position ?? 0,
      });
    }
    return out;
  };

  // Google has no public Links API. URL Inspection exposes a small referringUrls
  // sample and permits about 600 calls per property per day.
  const inspectUrl = async (
    ctx: Ctx,
    args: { inspectionUrl: string; languageCode?: string; sitePropertyUrl: string },
  ): Promise<UrlInspectionResult> => {
    const client = await getClient(ctx);
    const res = await client.urlInspection.index.inspect({
      requestBody: {
        inspectionUrl: args.inspectionUrl,
        languageCode: args.languageCode ?? "en-US",
        siteUrl: args.sitePropertyUrl,
      },
    });
    const idx = res.data.inspectionResult?.indexStatusResult;
    return {
      coverageState: idx?.coverageState ?? null,
      referringUrls: idx?.referringUrls ?? [],
    };
  };

  const pagePerformance = async (
    ctx: Ctx,
    siteUrl: string,
    pageUrl: string,
    days: number,
  ): Promise<PagePerformance | null> => {
    const client = await getClient(ctx);
    const res = await client.searchanalytics.query({
      requestBody: {
        ...dateRange(days),
        dimensionFilterGroups: [
          { filters: [{ dimension: "page", expression: pageUrl, operator: "equals" }] },
        ],
        rowLimit: 1,
      },
      siteUrl,
    });
    const row = res.data.rows?.[0];
    if (!row) {
      return null;
    }
    return {
      clicks: row.clicks ?? 0,
      ctr: row.ctr ?? 0,
      impressions: row.impressions ?? 0,
      position: row.position ?? 0,
    };
  };

  return {
    inspectUrl,
    listVerifiedSites,
    pagePerformance,
    resolveSiteUrl,
    topPages,
    topQueries,
    totals,
  };
};

const {
  inspectUrl,
  listVerifiedSites,
  pagePerformance,
  resolveSiteUrl,
  topPages,
  topQueries,
  totals,
} = createSearchConsoleOperations(sc);

export {
  createSearchConsoleOperations,
  inspectUrl,
  listVerifiedSites,
  pagePerformance,
  resolveSiteUrl,
  topPages,
  topQueries,
  totals,
};
export type {
  Ctx,
  GetSearchConsoleClient,
  PagePerformance,
  SearchAnalyticsTotals,
  SearchConsoleClient,
  TopPage,
  TopQuery,
  UrlInspectionResult,
};
