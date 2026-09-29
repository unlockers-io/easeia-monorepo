import { prisma } from "@repo/db";
import { loadConnection, resolveSiteUrl, topQueries } from "@repo/search-console";

import { env } from "./env";
import { log } from "./logger";

// Best-effort: topic selection must survive a missing Google connection,
// an unverified property, or a Google API outage, so every failure path
// collapses to an empty list instead of throwing.
const fetchTopSearchQueries = async (domain: string): Promise<Array<string>> => {
  try {
    if (env.APP_URL === undefined) {
      return [];
    }
    const connection = await prisma.googleConnection.findFirst({ select: { userId: true } });
    if (!connection || (await loadConnection(connection.userId)) === null) {
      return [];
    }
    const ctx = {
      redirectUri: `${env.APP_URL.replace(/\/$/v, "")}/api/google/callback`,
      userId: connection.userId,
    };
    const siteUrl = await resolveSiteUrl(ctx, domain);
    if (siteUrl === null) {
      return [];
    }
    const rows = await topQueries(ctx, siteUrl, { days: 28, limit: 20 });
    return rows.map((r) => r.query);
  } catch (error) {
    log.warn({ domain, err: error, message: "gsc top queries fetch failed" });
    return [];
  }
};

export { fetchTopSearchQueries };
