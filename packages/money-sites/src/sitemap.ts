const LOC_RE = /<loc>(?<loc>[^<]+)<\/loc>/giv;

/** Distinct: a duplicate within one batch breaks the batched insert that consumes this. */
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
