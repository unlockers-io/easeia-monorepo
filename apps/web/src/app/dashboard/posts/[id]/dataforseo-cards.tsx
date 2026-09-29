import { auditPage, DataForSeoError, serpOrganic } from "@repo/dataforseo";
import { Badge } from "@repo/ui/components/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import { CheckCircle2, Gauge, Search, Target, XCircle } from "lucide-react";

import { ProviderErrorCard } from "@/app/dashboard/lib/provider-card";
import { tryProvider } from "@/app/dashboard/lib/provider-result";
import { onPageCheckPassed } from "@/app/dashboard/sites/[id]/audit-check-filter";

const DATAFORSEO_DESCRIPTION = "DataForSEO unavailable.";

type HumanContract = Record<string, string>;

const HUMAN = {
  canonical: "Canonical link",
  duplicate_description: "Duplicate meta description",
  duplicate_meta_tags: "Duplicate meta tags",
  duplicate_title_tag: "Duplicate title",
  high_loading_time: "Slow page load",
  irrelevant_description: "Description doesn't match content",
  irrelevant_meta_keywords: "Meta keywords irrelevant",
  irrelevant_title: "Title doesn't match content",
  is_4xx_code: "4xx response",
  is_5xx_code: "5xx response",
  is_broken: "Broken page",
  is_https: "HTTPS",
  is_redirect: "Redirect",
  no_content_encoding: "Missing content encoding",
  no_description: "Missing meta description",
  no_doctype: "Missing doctype",
  no_favicon: "Missing favicon",
  no_h1_tag: "Missing H1",
  no_image_alt: "Images missing alt",
  no_image_title: "Images missing title",
  no_title: "Missing title",
  seo_friendly_url: "SEO-unfriendly URL",
  small_page_size: "Page too small",
  title_too_long: "Title too long",
  title_too_short: "Title too short",
} satisfies HumanContract;

const humanByCheck = new Map<string, string>(Object.entries(HUMAN));

export const SerpRankCard = async ({
  focusKeyword,
  siteDomain,
  url,
}: {
  focusKeyword: string;
  siteDomain: string;
  url: string;
}) => {
  const outcome = await tryProvider(() => serpOrganic(focusKeyword, siteDomain), [DataForSeoError]);
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
          Live Google position for{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">{focusKeyword}</code> (US,
          English).
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
  const outcome = await tryProvider(() => auditPage(url), [DataForSeoError]);
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

  const checkEntries = Object.entries(audit.checks);
  const failing = checkEntries.filter(([name, value]) => !onPageCheckPassed(name, value));
  const passing = checkEntries.length - failing.length;

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
            {passing} passing
          </span>
          <span className="inline-flex items-center gap-1 text-destructive">
            <XCircle className="size-3.5" />
            {failing.length} failing
          </span>
        </div>
        {failing.length === 0 ? (
          <p className="text-sm text-muted-foreground">No optimization issues detected.</p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {failing.map(([key]) => (
              <li className="flex items-baseline gap-2" key={key}>
                <XCircle className="size-3.5 h-lh shrink-0 text-destructive" />
                <span>{humanByCheck.get(key) ?? key}</span>
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
