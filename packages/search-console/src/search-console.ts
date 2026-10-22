import type { searchconsole_v1 } from "@googleapis/searchconsole";
import { prisma, type GoogleConnection } from "@repo/db";

import { decryptSecret, encryptSecret } from "./crypto";
import { GoogleAuthError } from "./errors";
import { googleApis, type Google, type SearchConsoleApi } from "./google";

const REFRESH_LEEWAY_MS = 60_000;

type SearchMetrics = {
  clicks: number;
  ctr: number;
  impressions: number;
  position: number;
};

type TopQuery = SearchMetrics & { query: string };

type TopPage = SearchMetrics & { page: string };

type UrlInspectionResult = {
  coverageState: string | null;
  referringUrls: ReadonlyArray<string>;
};

type VerifiedSite = {
  permission: string;
  siteUrl: string;
};

type SearchWindow = { days: number; limit: number };

type SiteSearchConsole = {
  inspectUrl: (inspectionUrl: string) => Promise<UrlInspectionResult>;
  pagePerformance: (pageUrl: string, days: number) => Promise<SearchMetrics | null>;
  property: string;
  topPages: (window: SearchWindow) => Promise<Array<TopPage>>;
  topQueries: (window: SearchWindow) => Promise<Array<TopQuery>>;
  totals: (days: number) => Promise<SearchMetrics | null>;
};

type SiteLookup =
  | { status: "not_connected" }
  | { status: "not_verified" }
  | ({ status: "ok" } & SiteSearchConsole);

const workspaceConnection = () =>
  prisma.googleConnection.findFirst({ orderBy: { createdAt: "asc" } });

const isConnected = async (): Promise<boolean> => (await workspaceConnection()) !== null;

const candidateProperties = (domain: string): Array<string> => {
  const bare = domain.replace(/^https?:\/\//v, "").replace(/\/$/v, "");

  return [`sc-domain:${bare}`, `https://${bare}/`, `http://${bare}/`];
};

const isoDay = (date: Date): string => date.toISOString().slice(0, 10);

const dateRange = (days: number) => {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - days);

  return { endDate: isoDay(end), startDate: isoDay(start) };
};

const toMetrics = (row: searchconsole_v1.Schema$ApiDataRow): SearchMetrics => ({
  clicks: row.clicks ?? 0,
  ctr: row.ctr ?? 0,
  impressions: row.impressions ?? 0,
  position: row.position ?? 0,
});

const firstRow = (
  response: searchconsole_v1.Schema$SearchAnalyticsQueryResponse,
): SearchMetrics | null => {
  const row = response.rows?.[0];

  return row ? toMetrics(row) : null;
};

const keyedRows = <T>(
  response: searchconsole_v1.Schema$SearchAnalyticsQueryResponse,
  build: (key: string, metrics: SearchMetrics) => T,
): Array<T> =>
  (response.rows ?? []).flatMap((row) => {
    const key = row.keys?.[0];

    return key === undefined || key === "" ? [] : [build(key, toMetrics(row))];
  });

const verifiedSites = async (api: SearchConsoleApi): Promise<Array<VerifiedSite>> => {
  const response = await api.listSites();

  return (response.siteEntry ?? []).flatMap(({ permissionLevel, siteUrl }) =>
    typeof siteUrl === "string" &&
    siteUrl !== "" &&
    typeof permissionLevel === "string" &&
    permissionLevel !== ""
      ? [{ permission: permissionLevel, siteUrl }]
      : [],
  );
};

const siteSearchConsole = (api: SearchConsoleApi, property: string): SiteSearchConsole => {
  const searchAnalytics = (body: searchconsole_v1.Schema$SearchAnalyticsQueryRequest) =>
    api.query(property, body);

  return {
    inspectUrl: async (inspectionUrl) => {
      const response = await api.inspect({
        inspectionUrl,
        languageCode: "en-US",
        siteUrl: property,
      });

      const index = response.inspectionResult?.indexStatusResult;

      return {
        coverageState: index?.coverageState ?? null,
        referringUrls: index?.referringUrls ?? [],
      };
    },
    pagePerformance: async (pageUrl, days) =>
      firstRow(
        await searchAnalytics({
          ...dateRange(days),
          dimensionFilterGroups: [
            { filters: [{ dimension: "page", expression: pageUrl, operator: "equals" }] },
          ],
          rowLimit: 1,
        }),
      ),
    property,
    topPages: async ({ days, limit }) =>
      keyedRows(
        await searchAnalytics({ ...dateRange(days), dimensions: ["page"], rowLimit: limit }),
        (page, metrics) => ({ ...metrics, page }),
      ),
    topQueries: async ({ days, limit }) =>
      keyedRows(
        await searchAnalytics({ ...dateRange(days), dimensions: ["query"], rowLimit: limit }),
        (query, metrics) => ({ ...metrics, query }),
      ),
    totals: async (days) => firstRow(await searchAnalytics({ ...dateRange(days), rowLimit: 1 })),
  };
};

const createSearchConsole = (google: Google) => {
  const refreshes = new Map<string, { accessToken: Promise<string>; staleExpiry: number }>();

  const refresh = async (connection: GoogleConnection): Promise<string> => {
    if (connection.refreshToken === null || connection.refreshToken === "") {
      throw new GoogleAuthError("Access token expired and no refresh token stored; reconnect");
    }

    const credentials = await google.refreshAccessToken(decryptSecret(connection.refreshToken));

    if (
      typeof credentials.access_token !== "string" ||
      credentials.access_token === "" ||
      typeof credentials.expiry_date !== "number"
    ) {
      throw new GoogleAuthError("Google did not return a refreshed access token; reconnect");
    }

    await prisma.googleConnection.update({
      data: {
        accessToken: encryptSecret(credentials.access_token),
        expiresAt: new Date(credentials.expiry_date),
      },
      where: { id: connection.id },
    });

    return credentials.access_token;
  };

  const refreshOnce = async (connection: GoogleConnection, staleExpiry: number) => {
    try {
      return await refresh(connection);
    } catch (error) {
      if (refreshes.get(connection.id)?.staleExpiry === staleExpiry) {
        refreshes.delete(connection.id);
      }

      throw error;
    }
  };

  const accessToken = (connection: GoogleConnection): Promise<string> => {
    const staleExpiry = connection.expiresAt.getTime();

    if (staleExpiry - Date.now() > REFRESH_LEEWAY_MS) {
      return Promise.resolve(decryptSecret(connection.accessToken));
    }

    const pending = refreshes.get(connection.id);

    if (pending?.staleExpiry === staleExpiry) {
      return pending.accessToken;
    }

    const refreshed = refreshOnce(connection, staleExpiry);
    refreshes.set(connection.id, { accessToken: refreshed, staleExpiry });

    return refreshed;
  };

  const forSite = async (domain: string): Promise<SiteLookup> => {
    const connection = await workspaceConnection();

    if (!connection) {
      return { status: "not_connected" };
    }

    const api = google.searchConsole(await accessToken(connection));
    const sites = await verifiedSites(api);
    const verified = new Set(sites.map((site) => site.siteUrl));
    const property = candidateProperties(domain).find((candidate) => verified.has(candidate));

    if (property === undefined) {
      return { status: "not_verified" };
    }

    return { status: "ok", ...siteSearchConsole(api, property) };
  };

  const listVerifiedSites = async (userId: string): Promise<Array<VerifiedSite>> => {
    const connection = await prisma.googleConnection.findUnique({ where: { userId } });

    if (!connection) {
      return [];
    }

    return verifiedSites(google.searchConsole(await accessToken(connection)));
  };

  return { forSite, listVerifiedSites };
};

const { forSite, listVerifiedSites } = createSearchConsole(googleApis);

export { createSearchConsole, forSite, isConnected, listVerifiedSites };

export type {
  SearchMetrics,
  SiteLookup,
  SiteSearchConsole,
  TopPage,
  TopQuery,
  UrlInspectionResult,
  VerifiedSite,
};
