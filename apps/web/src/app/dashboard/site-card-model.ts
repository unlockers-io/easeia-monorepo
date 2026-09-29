import type { MoneySite, Site, SiteSnapshot } from "@repo/db";
import type { Recommendation } from "@repo/health";

type MoneySiteSummary = Pick<MoneySite, "id" | "name" | "domain">;

type SiteCardModel = {
  latest: SiteSnapshot | null;
  moneySite: MoneySiteSummary | null;
  prior: SiteSnapshot | null;
  recommendations: Array<Recommendation>;
  site: Site;
};

type Standing = "attention" | "good" | "pending" | "unreachable" | "watch";

const standingOf = (snapshot: SiteSnapshot | null): Standing => {
  if (snapshot === null) {
    return "pending";
  }
  if (!snapshot.reachable) {
    return "unreachable";
  }
  if (snapshot.healthScore === null) {
    return "pending";
  }
  if (snapshot.healthScore < 50) {
    return "attention";
  }
  if (snapshot.healthScore < 60) {
    return "watch";
  }
  return "good";
};

const STANDING_LABEL = {
  attention: "Attention",
  good: "Good",
  pending: "Pending",
  unreachable: "Unreachable",
  watch: "Watch",
} satisfies Record<Standing, string>;

const STANDING_TEXT = {
  attention: "text-destructive",
  good: "text-success",
  pending: "text-muted-foreground",
  unreachable: "text-destructive",
  watch: "text-warning",
} satisfies Record<Standing, string>;

const STANDING_FILL = {
  attention: "bg-destructive",
  good: "bg-foreground",
  pending: "bg-muted-foreground/40",
  unreachable: "bg-destructive",
  watch: "bg-warning",
} satisfies Record<Standing, string>;

const trendLabel = (latest: SiteSnapshot | null, prior: SiteSnapshot | null): string => {
  if (latest?.healthScore === null || latest?.healthScore === undefined) {
    return "No score yet";
  }
  if (prior?.healthScore === null || prior?.healthScore === undefined) {
    return "No prior snapshot";
  }
  const delta = latest.healthScore - prior.healthScore;
  if (delta === 0) {
    return "Unchanged vs prior week";
  }
  return `${delta > 0 ? "+" : "−"}${Math.abs(delta)} vs prior week`;
};

const formatPosition = (position: number | null | undefined): string =>
  position === null || position === undefined ? "—" : position.toFixed(1);

const formatLastPost = (days: number | null | undefined): string => {
  if (days === null || days === undefined) {
    return "—";
  }
  return days === 0 ? "today" : `${days}d`;
};

export {
  formatLastPost,
  formatPosition,
  STANDING_FILL,
  STANDING_LABEL,
  STANDING_TEXT,
  standingOf,
  trendLabel,
};
export type { SiteCardModel, Standing };
