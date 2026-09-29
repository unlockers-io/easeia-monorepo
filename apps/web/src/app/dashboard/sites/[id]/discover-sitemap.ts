/** Live sitemap discovery. Same-site includes www↔apex so Vercel 308s aren't misses. */

const SITEMAP_FALLBACKS = ["/sitemap.xml", "/sitemap_index.xml", "/sitemap-index.xml"] as const;
const PROBE_TIMEOUT_MS = 5000;

const hostnameKey = (host: string): string =>
  host
    .replace(/\.$/v, "")
    .replace(/^www\./iv, "")
    .toLowerCase();

const isHttpFamily = (protocol: string): boolean => protocol === "http:" || protocol === "https:";

/**
 * True when `candidate` is the same registrable host as `base`, ignoring a
 * leading `www.` and allowing http↔https. Rejects any other host.
 */
export const isSameSite = (candidate: string, base: string): boolean => {
  try {
    const a = new URL(candidate);
    const b = new URL(base);
    return (
      isHttpFamily(a.protocol) &&
      isHttpFamily(b.protocol) &&
      hostnameKey(a.hostname) === hostnameKey(b.hostname)
    );
  } catch {
    return false;
  }
};

const addRobotsSitemaps = (body: string, origin: string, candidates: Set<string>): void => {
  for (const match of body.matchAll(/^\s*Sitemap:\s*(?<url>\S+)/gimv)) {
    const [, raw] = match;
    if (raw === undefined) {
      throw new Error("addRobotsSitemaps: Sitemap line matched without its capture group");
    }
    if (raw === "") {
      continue;
    }
    try {
      const absolute = new URL(raw, origin).href;
      if (isSameSite(absolute, origin)) {
        candidates.add(absolute);
      }
    } catch {
      // skip malformed Sitemap: lines
    }
  }
};

const probeWithMethod = async (
  url: string,
  method: "GET" | "HEAD",
  origin: string,
): Promise<string> => {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, PROBE_TIMEOUT_MS);
  try {
    const probe = await fetch(url, {
      cache: "no-store",
      method,
      redirect: "follow",
      signal: controller.signal,
    });
    const finalUrl = probe.url || url;
    if (probe.ok && isSameSite(finalUrl, origin)) {
      return finalUrl;
    }
    throw new Error("not ok or cross-origin");
  } finally {
    clearTimeout(timer);
  }
};

const probeOne = async (url: string, origin: string): Promise<string> => {
  try {
    return await probeWithMethod(url, "HEAD", origin);
  } catch {
    // Many static hosts 405 HEAD on XML even when GET is fine.
    return probeWithMethod(url, "GET", origin);
  }
};

/** Checks robots.txt first, then common Astro/static sitemap paths. */
export const discoverSitemap = async (siteUrl: string): Promise<string | null> => {
  const base = siteUrl.replace(/\/?$/v, "");
  let origin: string;
  try {
    origin = new URL(base).origin;
  } catch {
    return null;
  }

  const candidates = new Set<string>();

  try {
    const robots = await fetch(`${base}/robots.txt`, {
      cache: "no-store",
      redirect: "follow",
    });
    const robotsUrl = robots.url || `${base}/robots.txt`;
    if (robots.ok && isSameSite(robotsUrl, origin)) {
      addRobotsSitemaps(await robots.text(), origin, candidates);
    }
  } catch {
    // robots.txt unreachable: fall through to fallbacks.
  }

  for (const path of SITEMAP_FALLBACKS) {
    candidates.add(`${base}${path}`);
  }

  try {
    return await Promise.any([...candidates].map((url) => probeOne(url, origin)));
  } catch {
    return null;
  }
};
