import type { SiteLanguage } from "@repo/db";
import { Badge } from "@repo/ui/components/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import { CheckCircle2, Gauge, Search, Target, XCircle } from "lucide-react";

import { auditPage, serpOrganic } from "@/app/dashboard/lib/dataforseo";
import { ProviderErrorCard } from "@/app/dashboard/lib/provider-card";

const DATAFORSEO_DESCRIPTION = "DataForSEO unavailable.";

export const SerpRankCard = async ({
  focusKeyword,
  siteDomain,
  siteLanguage,
  url,
}: {
  focusKeyword: string;
  siteDomain: string;
  siteLanguage: SiteLanguage;
  url: string;
}) => {
  const outcome = await serpOrganic(siteDomain, siteLanguage, focusKeyword);

  if (!outcome.ok) {
    return (
      <ProviderErrorCard
        description={DATAFORSEO_DESCRIPTION}
        message={outcome.error}
        title="SERP rank"
      />
    );
  }

  const result = outcome.data;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="size-4 text-muted-foreground" />
          SERP rank
        </CardTitle>
        <CardDescription>
          Google position for{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">{focusKeyword}</code> (
          {result.market}).
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {result.matched ? (
          <div className="flex items-baseline gap-3">
            <p className="text-4xl font-semibold tabular-nums">#{result.matched.rank}</p>
            <p className="text-sm text-muted-foreground">in top 20 organic results</p>
          </div>
        ) : (
          <div className="flex items-baseline gap-3">
            <p className="text-2xl font-semibold text-muted-foreground">Not in top 20</p>
          </div>
        )}
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">Top 5 organic results</p>
          <ol className="flex flex-col gap-2 text-sm">
            {result.top.slice(0, 5).map((p) => {
              const isThis = p.url === url;

              return (
                <li className="flex items-baseline gap-2" key={`${p.rank}-${p.url}`}>
                  <span className="w-7 shrink-0 text-xs font-semibold text-muted-foreground tabular-nums">
                    #{p.rank}
                  </span>
                  <a
                    className={`flex-1 truncate hover:underline ${isThis ? "font-semibold" : ""}`}
                    href={p.url}
                    rel="noreferrer"
                    target="_blank"
                  >
                    {p.title}
                  </a>
                  {isThis && <Badge variant="default">this post</Badge>}
                </li>
              );
            })}
          </ol>
        </div>
      </CardContent>
    </Card>
  );
};

export const PostAuditCard = async ({ url }: { url: string }) => {
  const outcome = await auditPage(url);

  if (!outcome.ok) {
    return (
      <ProviderErrorCard
        description={DATAFORSEO_DESCRIPTION}
        message={outcome.error}
        title="Page audit"
      />
    );
  }

  const audit = outcome.data;

  if (!audit) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Page audit</h2>
          </CardTitle>
          <CardDescription>No audit returned.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const { failed, passed } = audit.checks;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Gauge className="size-4 text-muted-foreground" />
          Page audit
        </CardTitle>
        <CardDescription>
          Score{" "}
          <span className="font-semibold tabular-nums">{audit.onpageScore?.toFixed(0) ?? "—"}</span>{" "}
          · {audit.wordCount?.toLocaleString() ?? "—"} words ·{" "}
          {audit.imagesCount?.toLocaleString() ?? "0"} images ·{" "}
          {audit.internalLinks?.toLocaleString() ?? "0"} internal links
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-center gap-3 text-xs">
          <span className="inline-flex items-center gap-1 text-primary">
            <CheckCircle2 className="size-3.5" />
            {passed} passing
          </span>
          <span className="inline-flex items-center gap-1 text-destructive">
            <XCircle className="size-3.5" />
            {failed.length} failing
          </span>
        </div>
        {failed.length === 0 ? (
          <p className="text-sm text-muted-foreground">No optimization issues detected.</p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {failed.map((check) => (
              <li className="flex items-baseline gap-2" key={check.name}>
                <XCircle className="size-3.5 h-lh shrink-0 text-destructive" />
                <span>{check.label}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
};

export const SeoNotApplicable = ({ reason }: { reason: string }) => (
  <Card>
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <Search className="size-4 text-muted-foreground" />
        SEO insights
      </CardTitle>
      <CardDescription>{reason}</CardDescription>
    </CardHeader>
  </Card>
);
