import { auditPage, DataForSeoError, domainRankOverview, rankedKeywords } from "@repo/dataforseo";
import { LinkType, prisma } from "@repo/db";
import { liveLinkWhere } from "@repo/links";
import { Badge } from "@repo/ui/components/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/table";
import { CheckCircle2, ExternalLink, XCircle } from "lucide-react";
import type { ReactNode } from "react";

import { tryProvider } from "@/app/dashboard/lib/provider-result";

import { onPageCheckPassed, partitionFailingChecks } from "./audit-check-filter";
import { ExternalBacklinksUpload } from "./external-backlinks-upload";
import { FailingChecksList } from "./failing-checks-list";

const DATAFORSEO_DESCRIPTION = "DataForSEO unavailable.";

export const SeoPanel = ({ children }: { children: ReactNode }) => (
  <div className="divide-y divide-border overflow-hidden rounded-xl border bg-card">{children}</div>
);

type SectionProps = {
  children: ReactNode;
  description?: ReactNode;
  flushBody?: boolean;
  title: string;
};

const Section = ({ children, description, flushBody = false, title }: SectionProps) => (
  <section className="flex flex-col gap-2 p-4">
    <header className="flex flex-col gap-1">
      <h3 className="text-base font-semibold">{title}</h3>
      {description === undefined ? null : (
        <p className="text-sm text-pretty text-muted-foreground">{description}</p>
      )}
    </header>
    <div className={flushBody ? "-mx-4 -mb-4" : ""}>{children}</div>
  </section>
);

const SectionError = ({ message, title }: { message: string; title: string }) => (
  <Section description={DATAFORSEO_DESCRIPTION} title={title}>
    <p className="text-sm text-destructive">{message}</p>
  </Section>
);

export const DomainRankCard = async ({ domain }: { domain: string }) => {
  const outcome = await tryProvider(() => domainRankOverview(domain), [DataForSeoError]);
  if (!outcome.ok) {
    return <SectionError message={outcome.error} title="Domain rank" />;
  }
  const overview = outcome.data;

  if (!overview) {
    return (
      <Section description="No data returned for this domain." title="Domain rank">
        <NoData as="p" className="text-sm text-muted-foreground" />
      </Section>
    );
  }

  return (
    <Section
      description={`Organic Google ranking distribution across ${overview.organicKeywords.toLocaleString()} keywords.`}
      title="Domain rank"
    >
      <dl className="grid grid-cols-2 gap-4 text-sm md:grid-cols-3">
        <Stat label="Organic keywords" value={overview.organicKeywords.toLocaleString()} />
        <Stat
          label="Est. monthly traffic value"
          value={`$${overview.organicTrafficValue.toFixed(0)}`}
        />
        <Stat label="Position 1" value={overview.pos1.toLocaleString()} />
        <Stat label="Position 2–3" value={overview.pos2to3.toLocaleString()} />
        <Stat label="Position 4–10" value={overview.pos4to10.toLocaleString()} />
        <Stat label="Position 11–20" value={overview.pos11to20.toLocaleString()} />
      </dl>
    </Section>
  );
};

export const OnPageAuditCard = async ({ siteId, url }: { siteId: string; url: string }) => {
  const outcome = await tryProvider(() => auditPage(url), [DataForSeoError]);
  if (!outcome.ok) {
    return <SectionError message={outcome.error} title="Homepage audit" />;
  }
  const audit = outcome.data;

  if (!audit) {
    return (
      <Section description="No audit returned." title="Homepage audit">
        <NoData as="p" className="text-sm text-muted-foreground" />
      </Section>
    );
  }

  const checkEntries = Object.entries(audit.checks);
  const failing = checkEntries.filter(([name, value]) => !onPageCheckPassed(name, value));
  const passing = checkEntries.length - failing.length;
  const { actionable, suppressed } = partitionFailingChecks(failing);

  return (
    <Section
      description={
        <>
          {audit.url} · score{" "}
          <span className="font-semibold tabular-nums">{audit.onpageScore?.toFixed(0) ?? "—"}</span>
        </>
      }
      title="Homepage audit"
    >
      <div className="grid gap-4 md:grid-cols-2">
        <ul className="flex flex-col gap-2 text-sm">
          <Fact label="Word count" value={audit.wordCount?.toLocaleString() ?? "—"} />
          <Fact label="Images" value={audit.imagesCount?.toLocaleString() ?? "—"} />
          <Fact label="Internal links" value={audit.internalLinks?.toLocaleString() ?? "—"} />
          <Fact label="External links" value={audit.externalLinks?.toLocaleString() ?? "—"} />
          <Fact
            label="LCP"
            value={
              typeof audit.largestContentfulPaintMs === "number" &&
              audit.largestContentfulPaintMs !== 0
                ? `${audit.largestContentfulPaintMs}ms`
                : "—"
            }
          />
          <Fact
            label="TTI"
            value={
              typeof audit.timeToInteractiveMs === "number" && audit.timeToInteractiveMs !== 0
                ? `${audit.timeToInteractiveMs}ms`
                : "—"
            }
          />
        </ul>
        <div className="flex flex-col gap-2 text-sm">
          <p className="text-xs font-medium text-muted-foreground">Checks</p>
          <div className="flex items-center gap-3 text-sm">
            <span className="inline-flex items-center gap-1 text-primary">
              <CheckCircle2 className="size-3.5" />
              {passing} passing
            </span>
            <span className="inline-flex items-center gap-1 text-destructive">
              <XCircle className="size-3.5" />
              {failing.length} failing
            </span>
          </div>
          {actionable.length > 0 ? (
            <FailingChecksList failing={actionable} siteId={siteId} />
          ) : null}
          {suppressed.length > 0 ? (
            <p className="text-xs text-muted-foreground">
              {suppressed.length} cosmetic / infra check{suppressed.length === 1 ? "" : "s"} hidden
              (favicon, status codes, render-blocking, etc.)
            </p>
          ) : null}
        </div>
      </div>
    </Section>
  );
};

export const TopKeywordsCard = async ({ domain }: { domain: string }) => {
  const outcome = await tryProvider(() => rankedKeywords(domain, 10), [DataForSeoError]);
  if (!outcome.ok) {
    return <SectionError message={outcome.error} title="Top organic keywords" />;
  }
  const kws = outcome.data;

  return (
    <Section
      description="Highest-ranking Google queries this domain shows up for."
      flushBody={kws.length > 0}
      title="Top organic keywords"
    >
      {kws.length === 0 ? (
        <p className="text-sm text-muted-foreground">No ranking keywords yet.</p>
      ) : (
        <div className="max-h-112 overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-card">
              <TableRow>
                <TableHead>Keyword</TableHead>
                <TableHead className="text-right">Rank</TableHead>
                <TableHead className="text-right">Volume</TableHead>
                <TableHead className="text-right">CPC</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {kws.map((kw) => (
                <TableRow key={`${kw.keyword}-${kw.rank}`}>
                  <TableCell className="text-sm">
                    {typeof kw.url === "string" && kw.url !== "" ? (
                      <a className="hover:underline" href={kw.url} rel="noreferrer" target="_blank">
                        {kw.keyword} <ExternalLink className="ml-0.5 inline size-3" />
                      </a>
                    ) : (
                      kw.keyword
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    <RankBadge rank={kw.rank} />
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums">
                    {kw.searchVolume?.toLocaleString() ?? "—"}
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums">
                    {typeof kw.cpc === "number" && kw.cpc !== 0 ? `$${kw.cpc.toFixed(2)}` : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </Section>
  );
};

export const BacklinksCard = async ({ siteId }: { siteId: string }) => {
  const realLinkFilter = {
    ...liveLinkWhere,
    toPost: { siteId },
    toPostId: { not: null },
    type: LinkType.PBN,
  };

  // tsgo (TypeScript 7.0.2) widens a five-element Promise.all over Prisma delegates to any[],
  // which turns every downstream callback parameter into an implicit any. Two smaller groups
  // stay within its tuple inference and keep the five queries running in parallel.
  const [[backlinks, rows], [externalRows, googleConnection, gscReferringSamples]] =
    await Promise.all([
      Promise.all([
        prisma.link.count({ where: realLinkFilter }),
        prisma.link.findMany({
          include: { fromPost: { select: { siteId: true } } },
          where: realLinkFilter,
        }),
      ]),
      Promise.all([
        prisma.externalBacklink.findMany({
          orderBy: { linkingPages: "desc" },
          select: { importedAt: true, linkingPages: true, source: true, sourceDomain: true },
          where: { siteId },
        }),
        prisma.googleConnection.findFirst({ select: { id: true } }),
        prisma.gscReferringUrl.findMany({
          orderBy: { observedAt: "desc" },
          select: { observedAt: true, referringUrl: true },
          take: 10,
          where: { siteId },
        }),
      ]),
    ]);
  const referringDomains = new Set(
    rows.flatMap((r) => (r.fromPost.siteId ? [r.fromPost.siteId] : [])),
  ).size;
  const referringPages = new Set(rows.map((r) => r.fromPostId)).size;

  const externalReferringDomains = externalRows.length;
  const externalLinkingPages = externalRows.reduce((sum, row) => sum + row.linkingPages, 0);
  const externalLastImportedAt = externalRows.reduce<Date | null>((latest, row) => {
    return !latest || row.importedAt > latest ? row.importedAt : latest;
  }, null);

  return (
    <Section
      description="Internal PBN links from our own Link table, plus external (off-network) backlinks ingested from a Google Search Console CSV export."
      title="Backlinks"
    >
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h4 className="text-xs font-medium text-muted-foreground">Internal (PBN)</h4>
          <dl className="grid grid-cols-2 gap-4 text-sm md:grid-cols-3">
            <Stat label="Backlinks" value={backlinks.toLocaleString()} />
            <Stat label="Referring sites" value={referringDomains.toLocaleString()} />
            <Stat label="Referring posts" value={referringPages.toLocaleString()} />
          </dl>
        </div>

        <div className="flex flex-col gap-2">
          <h4 className="text-xs font-medium text-muted-foreground">External (GSC)</h4>
          {externalRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Upload a GSC Links CSV or click &ldquo;Auto-import from Search Console&rdquo; below to
              populate.
            </p>
          ) : (
            <dl className="grid grid-cols-2 gap-4 text-sm md:grid-cols-3">
              <Stat label="Linking pages" value={externalLinkingPages.toLocaleString()} />
              <Stat label="Referring domains" value={externalReferringDomains.toLocaleString()} />
              <Stat
                label="Last import"
                value={externalLastImportedAt ? externalLastImportedAt.toLocaleDateString() : "—"}
              />
            </dl>
          )}
          {gscReferringSamples.length > 0 ? (
            <div className="flex flex-col gap-1 border-t pt-2">
              <p className="text-xs font-medium text-muted-foreground">
                Latest referring URLs from Search Console
              </p>
              <ul className="flex max-h-80 flex-col gap-1 overflow-y-auto text-sm">
                {gscReferringSamples.map((s) => (
                  <li className="flex items-baseline gap-2" key={s.referringUrl}>
                    <a
                      className="flex-1 truncate text-muted-foreground hover:text-foreground"
                      href={s.referringUrl}
                      rel="noreferrer"
                      target="_blank"
                      title={s.referringUrl}
                    >
                      {s.referringUrl}
                    </a>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {s.observedAt.toLocaleDateString()}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <ExternalBacklinksUpload hasGoogleConnection={Boolean(googleConnection)} siteId={siteId} />
      </div>
    </Section>
  );
};

const TONES = {
  default: "text-foreground",
  destructive: "text-destructive",
} as const;

const Stat = ({
  label,
  tone = "default",
  value,
}: {
  label: string;
  tone?: keyof typeof TONES;
  value: string;
}) => (
  <div className="flex flex-col gap-1">
    <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
    <dd className={`text-xl font-semibold tabular-nums ${TONES[tone]}`}>{value}</dd>
  </div>
);

const EM_DASH = "—";

const NoData = ({ as: As = "span", className }: { as?: "span" | "p"; className?: string }) => (
  <As className={className}>{EM_DASH}</As>
);

const Fact = ({ label, value }: { label: string; value: string }) => (
  <li className="flex items-center justify-between text-sm">
    <span className="text-muted-foreground">{label}</span>
    <span className="font-medium tabular-nums">{value}</span>
  </li>
);

const RankBadge = ({ rank }: { rank: number }) => {
  if (rank === 0) {
    return <NoData className="text-muted-foreground" />;
  }
  if (rank <= 3) {
    return <Badge variant="default">#{rank}</Badge>;
  }
  if (rank <= 10) {
    return <Badge variant="secondary">#{rank}</Badge>;
  }
  return <Badge variant="outline">#{rank}</Badge>;
};
