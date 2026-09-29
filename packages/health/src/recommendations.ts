import type { SiteSnapshot } from "@repo/db";
import { z } from "zod";

type RecommendationPriority = 1 | 2 | 3;

type Recommendation = {
  action?: { href: string; label: string };
  id: string;
  message: string;
  priority: RecommendationPriority;
};

type RecommendationContext = {
  latest: SiteSnapshot;
  prior: SiteSnapshot | null;
  siteId: string;
};

type Rule = (ctx: RecommendationContext) => Recommendation | null;

const sitePostsHref = (siteId: string) => `/dashboard/sites/${siteId}`;

const unreachable: Rule = ({ latest, siteId }) => {
  if (latest.reachable) {
    return null;
  }
  return {
    action: { href: sitePostsHref(siteId), label: "Open site" },
    id: "unreachable",
    message: "Site unreachable; check WP REST and app password",
    priority: 1,
  };
};

const noPublishRecent: Rule = ({ latest, siteId }) => {
  const days = latest.daysSinceLastPublish;
  if (days === null || days <= 21) {
    return null;
  }
  return {
    action: { href: sitePostsHref(siteId), label: "Open site" },
    id: "noPublishRecent",
    message: `No publish in ${days}d; schedule a post`,
    priority: 1,
  };
};

const rankDropped: Rule = ({ latest, prior, siteId }) => {
  const priorRank = prior?.domainRank ?? null;
  if (priorRank === null || latest.domainRank === null || priorRank - latest.domainRank < 5) {
    return null;
  }
  const drop = priorRank - latest.domainRank;
  return {
    action: { href: sitePostsHref(siteId), label: "Open site" },
    id: "rankDropped",
    message: `Domain rank dropped ${drop}; audit recent changes`,
    priority: 2,
  };
};

const gscClicksDropped: Rule = ({ latest, prior, siteId }) => {
  const priorClicks = prior?.gscClicks ?? null;
  if (
    priorClicks === null ||
    latest.gscClicks === null ||
    priorClicks === 0 ||
    latest.gscClicks >= priorClicks * 0.7
  ) {
    return null;
  }
  const pct = Math.round(((priorClicks - latest.gscClicks) / priorClicks) * 100);
  return {
    action: { href: sitePostsHref(siteId), label: "Open site" },
    id: "gscClicksDropped",
    message: `GSC clicks down ${pct}% week-over-week`,
    priority: 2,
  };
};

const lowOnPageScore: Rule = ({ latest, siteId }) => {
  if (latest.onPageScore === null || latest.onPageScore >= 70) {
    return null;
  }
  return {
    action: { href: sitePostsHref(siteId), label: "Open site" },
    id: "lowOnPageScore",
    message: `On-page audit score ${Math.round(latest.onPageScore)}; review homepage`,
    priority: 2,
  };
};

const gscErrorsSchema = z.looseObject({
  gsc: z.string().optional(),
});

const gscNotConnected: Rule = ({ latest, siteId }) => {
  if (latest.gscImpressions !== null) {
    return null;
  }
  const errors = gscErrorsSchema.safeParse(latest.errors);
  if (!errors.success || errors.data.gsc !== "not_connected") {
    return null;
  }
  return {
    action: { href: sitePostsHref(siteId), label: "Open site" },
    id: "gscNotConnected",
    message: "Connect Search Console for richer signals",
    priority: 3,
  };
};

const noRefDomains: Rule = ({ latest, siteId }) => {
  if (latest.referringDomains === null || latest.referringDomains >= 5) {
    return null;
  }
  return {
    action: { href: sitePostsHref(siteId), label: "Open site" },
    id: "noRefDomains",
    message: `${latest.referringDomains} referring domains; consider link-building`,
    priority: 3,
  };
};

const lowCadence: Rule = ({ latest, siteId }) => {
  if (latest.postsLast30d >= 4) {
    return null;
  }
  return {
    action: { href: sitePostsHref(siteId), label: "Open site" },
    id: "lowCadence",
    message: `Cadence below 1 post/week (${latest.postsLast30d} in 30d); increase output`,
    priority: 3,
  };
};

const RULES: ReadonlyArray<Rule> = [
  unreachable,
  noPublishRecent,
  rankDropped,
  gscClicksDropped,
  lowOnPageScore,
  gscNotConnected,
  noRefDomains,
  lowCadence,
];

const buildRecommendations = (ctx: RecommendationContext): Array<Recommendation> => {
  const triggered = RULES.flatMap((rule) => {
    const recommendation = rule(ctx);
    return recommendation === null ? [] : [recommendation];
  });
  triggered.sort((a, b) => a.priority - b.priority);
  return triggered.slice(0, 3);
};

export { buildRecommendations };
export type { Recommendation, RecommendationContext, RecommendationPriority };
