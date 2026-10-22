import { forSite } from "@repo/search-console";

import { log } from "./logger";

// Best-effort: topic selection must survive a missing Google connection,
// an unverified property, or a Google API outage, so every failure path
// collapses to an empty list instead of throwing.
const fetchTopSearchQueries = async (domain: string): Promise<Array<string>> => {
  try {
    const site = await forSite(domain);

    if (site.status !== "ok") {
      return [];
    }

    const rows = await site.topQueries({ days: 28, limit: 20 });

    return rows.map((r) => r.query);
  } catch (error) {
    log.warn({ domain, err: error, message: "gsc top queries fetch failed" });

    return [];
  }
};

export { fetchTopSearchQueries };
