import { badgeVariants } from "@repo/ui/components/badge";
import { buttonVariants } from "@repo/ui/components/button";
import { cn } from "@repo/ui/lib/utils";
import Link from "next/link";

import {
  formatPosition,
  STANDING_LABEL,
  STANDING_TEXT,
  standingOf,
  trendLabel,
} from "./site-card-model";
import type { SiteCardModel } from "./site-card-model";

const PRIORITY_CLASS = {
  1: "text-destructive",
  2: "text-warning",
  3: "text-muted-foreground",
} satisfies Record<1 | 2 | 3, string>;

const Figure = ({ label, value }: { label: string; value: string }) => (
  <div className="pr-3">
    <dd className="text-(length:--text-heading-sm) font-extrabold tracking-display tabular-nums">
      {value}
    </dd>
    <dt className="text-xs font-semibold text-muted-foreground">{label}</dt>
  </div>
);

/**
 * One row of section 01: the score at display size on the left, the site's
 * identity, prioritized recommendations, and key figures on the right.
 */
const AttentionRow = ({ card }: { card: SiteCardModel }) => {
  const { latest, moneySite, prior, recommendations, site } = card;
  const standing = standingOf(latest);
  const score = latest?.healthScore;
  const isWatch = standing === "watch";

  return (
    <article className="grid gap-4 border-b border-border py-5 md:grid-cols-site-detail md:gap-x-4">
      <div className="flex items-baseline gap-4 md:block">
        <p
          className={`text-5xl font-extrabold tracking-tighter tabular-nums md:text-(length:--text-display) md:leading-display-compact ${STANDING_TEXT[standing]}`}
        >
          {score ?? "—"}
        </p>
        <div className="flex flex-col gap-2 md:mt-2">
          <p className="text-xs text-muted-foreground tabular-nums">{trendLabel(latest, prior)}</p>
          <span
            className={cn(
              badgeVariants({ variant: isWatch ? "outline" : "destructive" }),
              isWatch && "bg-warning text-warning-foreground",
            )}
          >
            {STANDING_LABEL[standing]}
          </span>
        </div>
      </div>

      <div className="grid min-w-0 gap-4 md:grid-cols-site-summary md:gap-x-8">
        <div className="min-w-0">
          <h3 className="text-(length:--text-heading-sm) font-extrabold tracking-tight break-all">
            <Link
              className="hover:underline hover:underline-offset-4"
              href={`/dashboard/sites/${site.id}`}
            >
              {site.domain}
            </Link>
          </h3>
          <p className="mt-1 text-(length:--text-label) text-muted-foreground">
            {site.niches.length === 0 ? "No niches" : site.niches.slice(0, 3).join(", ")}
            {moneySite ? (
              <>
                {" · feeds "}
                <a
                  className="hover:text-foreground hover:underline hover:underline-offset-4"
                  href={`https://${moneySite.domain}`}
                  rel="noreferrer"
                  target="_blank"
                >
                  {moneySite.name}
                </a>
              </>
            ) : null}
            {latest?.daysSinceLastPublish === null || latest?.daysSinceLastPublish === undefined
              ? null
              : ` · last post ${latest.daysSinceLastPublish}d ago`}
          </p>
          {recommendations.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              {latest ? "Nothing flagged" : "Awaiting first snapshot"}
            </p>
          ) : (
            <ol className="mt-3 flex flex-col">
              {recommendations.map((rec) => (
                <li
                  className="grid grid-cols-site-metric gap-2 border-t border-border py-1.5 text-(length:--text-label-lg)"
                  key={rec.id}
                >
                  <span
                    className={`pt-0.5 text-xs font-extrabold tracking-label ${PRIORITY_CLASS[rec.priority]}`}
                  >
                    P{rec.priority}
                  </span>
                  <span>{rec.message}</span>
                </li>
              ))}
            </ol>
          )}
        </div>

        <dl className="grid grid-cols-3 self-start border-t border-foreground pt-2.5">
          <Figure label="Domain rank" value={latest?.domainRank?.toString() ?? "—"} />
          <Figure
            label="Referring domains"
            value={latest?.referringDomains?.toLocaleString() ?? "—"}
          />
          <Figure label="Avg position" value={formatPosition(latest?.gscAvgPosition)} />
        </dl>

        <div className="flex gap-2 md:col-span-2">
          <Link
            className={cn(buttonVariants({ size: "lg", variant: "outline" }))}
            href={`/dashboard/sites/${site.id}`}
            prefetch
          >
            Open site
          </Link>
          <a
            className={cn(buttonVariants({ size: "lg", variant: "ghost" }))}
            href={`https://${site.domain}`}
            rel="noreferrer"
            target="_blank"
          >
            Visit
          </a>
        </div>
      </div>
    </article>
  );
};

export { AttentionRow };
