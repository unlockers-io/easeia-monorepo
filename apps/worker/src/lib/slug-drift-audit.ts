import { PostStatus, prisma, type Site } from "@repo/db";
import { postPath } from "@repo/sites";

import { log } from "./logger";

const PUBLISH_GRACE_MS = 6 * 60 * 60 * 1000;

const FETCH_TIMEOUT_MS = 20_000;

const EXAMPLES_PER_SITE = 5;

type AuditSite = Pick<Site, "categorySlugMap" | "defaultCategory" | "domain" | "id">;

type AuditPost = { categories: Array<string>; siteId: string; slug: string };

type SiteFinding = {
  domain: string;
  mismatched: Array<{ derived: string; live: string; slug: string }>;
  missing: Array<{ derived: string; slug: string }>;
};

type AuditResult = {
  mismatched: number;
  missing: number;
  sitesChecked: number;
  sitesSkipped: number;
};

type FetchText = (url: string) => Promise<string | null>;

const defaultFetchText: FetchText = async (url) => {
  const res = await fetch(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) {
    return null;
  }
  return res.text();
};

const locsOf = (xml: string): Array<string> =>
  [...xml.matchAll(/<loc>(?<loc>[^<]+)<\/loc>/gv)].map((m) =>
    (m.groups?.loc ?? "").replaceAll("&amp;", "&"),
  );

const fetchLivePaths = async (
  domain: string,
  fetchText: FetchText,
): Promise<Map<string, string> | null> => {
  const index = await fetchText(`https://${domain}/sitemap-index.xml`);
  if (index === null) {
    return null;
  }
  const children = locsOf(index).filter((loc) => loc.endsWith(".xml"));
  const pages = await Promise.allSettled(children.map((child) => fetchText(child)));

  const bySlug = new Map<string, string>();
  for (const page of pages) {
    if (page.status !== "fulfilled" || page.value === null) {
      return null;
    }
    for (const loc of locsOf(page.value)) {
      const segments = new URL(loc).pathname.split("/").filter(Boolean);
      if (segments.length === 2 && segments[0] !== "tag") {
        bySlug.set(segments[1] ?? "", `/${segments.join("/")}/`);
      }
    }
  }
  return bySlug;
};

const auditSite = (
  site: AuditSite,
  posts: Array<AuditPost>,
  liveBySlug: Map<string, string>,
): SiteFinding => {
  const finding: SiteFinding = { domain: site.domain, mismatched: [], missing: [] };
  for (const post of posts) {
    const derived = postPath(site, post);
    const live = liveBySlug.get(post.slug);
    if (live === undefined) {
      finding.missing.push({ derived, slug: post.slug });
    } else if (live !== derived) {
      finding.mismatched.push({ derived, live, slug: post.slug });
    }
  }
  return finding;
};

type Deps = {
  fetchText: FetchText;
  findPosts: () => Promise<Array<AuditPost>>;
  findSites: () => Promise<Array<AuditSite>>;
  logger: Pick<typeof log, "error" | "info" | "warn">;
};

const defaultFindSites = (): Promise<Array<AuditSite>> =>
  prisma.site.findMany({
    select: { categorySlugMap: true, defaultCategory: true, domain: true, id: true },
    where: { isEnabled: true },
  });

const defaultFindPosts = (): Promise<Array<AuditPost>> =>
  prisma.post.findMany({
    select: { categories: true, siteId: true, slug: true },
    where: {
      publishedAt: { lt: new Date(Date.now() - PUBLISH_GRACE_MS) },
      status: PostStatus.PUBLISHED,
    },
  });

export const makeAuditSlugDrift =
  ({ fetchText, findPosts, findSites, logger }: Deps) =>
  async (): Promise<AuditResult> => {
    const [sites, posts] = await Promise.all([findSites(), findPosts()]);

    const postsBySite = new Map<string, Array<AuditPost>>();
    for (const post of posts) {
      const group = postsBySite.get(post.siteId);
      if (group === undefined) {
        postsBySite.set(post.siteId, [post]);
      } else {
        group.push(post);
      }
    }

    const findings = await Promise.allSettled(
      sites.flatMap((site) => {
        const sitePosts = postsBySite.get(site.id) ?? [];
        if (sitePosts.length === 0) {
          return [];
        }
        return (async () => {
          let liveBySlug: Map<string, string> | null = null;
          try {
            liveBySlug = await fetchLivePaths(site.domain, fetchText);
          } catch (error) {
            logger.warn({
              domain: site.domain,
              err: error,
              message: "slug-drift: sitemap fetch failed",
            });
          }
          return liveBySlug === null ? null : auditSite(site, sitePosts, liveBySlug);
        })();
      }),
    );

    const result: AuditResult = { mismatched: 0, missing: 0, sitesChecked: 0, sitesSkipped: 0 };
    for (const settled of findings) {
      const finding = settled.status === "fulfilled" ? settled.value : null;
      if (finding === null) {
        result.sitesSkipped += 1;
        continue;
      }
      result.sitesChecked += 1;
      const mismatched = finding.mismatched.length;
      const missing = finding.missing.length;
      result.mismatched += mismatched;
      result.missing += missing;
      if (mismatched > 0 || missing > 0) {
        logger.error({
          domain: finding.domain,
          message: "slug-drift: derived URLs diverge from live site",
          mismatched,
          mismatchedExamples: finding.mismatched.slice(0, EXAMPLES_PER_SITE),
          missing,
          missingExamples: finding.missing.slice(0, EXAMPLES_PER_SITE),
        });
      }
    }

    logger.info({ message: "slug-drift: audit done", ...result });
    return result;
  };

export const auditSlugDrift = makeAuditSlugDrift({
  fetchText: defaultFetchText,
  findPosts: defaultFindPosts,
  findSites: defaultFindSites,
  logger: log,
});
