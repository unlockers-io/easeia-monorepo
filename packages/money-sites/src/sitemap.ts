const LOC_RE = /<loc>(?<loc>[^<]+)<\/loc>/giv;

/**
 * Distinct locs. A sitemap listing a URL twice previously produced two write
 * attempts and inflated both counters, and duplicates within one batch would
 * break the batched insert that consumes this.
 */
export const extractLocs = (xml: string): Array<string> => {
  const out = new Set<string>();
  for (const m of xml.matchAll(LOC_RE)) {
    const loc = m[1]?.trim();
    if (loc !== undefined && loc !== "") {
      out.add(loc);
    }
  }
  return [...out];
};

export const filterContentPaths = (
  urls: ReadonlyArray<string>,
  prefix: string | null,
): Array<string> => {
  if (prefix === null || prefix === "") {
    return [...urls];
  }
  return urls.filter((u) => {
    try {
      const { pathname } = new URL(u);
      return pathname.startsWith(prefix);
    } catch {
      return false;
    }
  });
};
