import { Niche, prisma, type Prisma } from "@repo/db";
import { toCategorySlugMap } from "@repo/sites";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import { Skeleton } from "@repo/ui/components/skeleton";
import { Suspense } from "react";

import { GscBackfillAllButton } from "./gsc-backfill-all-button";
import { SiteCreateDialog } from "./site-create-dialog";
import SitesTable, { type SiteRow } from "./sites-table";

type SearchParams = {
  enabled?: string;
  niche?: string | Array<string>;
  q?: string;
};

const NICHE_VALUES = new Set<string>(Object.values(Niche));

const toArray = (input: string | Array<string> | undefined): Array<string> => {
  if (input === undefined) {
    return [];
  }
  return Array.isArray(input) ? input : [input];
};

const SitesEmptyState = () => (
  <div className="space-y-3 py-6 text-sm">
    <h2 className="text-lg font-medium">No sites yet</h2>
    <p className="max-w-prose text-muted-foreground">
      Add your first Astro site, configure its deploy hook, then create a post.
    </p>
    <SiteCreateDialog />
  </div>
);

const SitesContent = async ({ searchParams }: { searchParams: Promise<SearchParams> }) => {
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const niches = toArray(params.niche).filter((n): n is Niche => NICHE_VALUES.has(n));
  const enabled: "" | "true" | "false" = (() => {
    if (params.enabled === "true") {
      return "true";
    }
    if (params.enabled === "false") {
      return "false";
    }
    return "";
  })();

  const where: Prisma.SiteWhereInput = {};
  if (q) {
    where.domain = { contains: q, mode: "insensitive" };
  }
  if (niches.length > 0) {
    where.niches = { hasSome: niches };
  }
  if (enabled) {
    where.isEnabled = enabled === "true";
  }

  const [sites, totalCount] = await Promise.all([
    prisma.site.findMany({
      orderBy: { domain: "asc" },
      where,
    }),
    prisma.site.count(),
  ]);

  if (totalCount === 0) {
    return <SitesEmptyState />;
  }

  // Captured once per request (Server Component) so every relative-time
  // string in the table formats against a single instant.
  // eslint-disable-next-line react-hooks-js/purity -- Server Component, not a re-rendering hook
  const nowMs = Date.now();

  const rows: Array<SiteRow> = sites.map((site) => ({
    autoPublishEnabled: site.autoPublishEnabled,
    cadenceDays: site.cadenceDays,
    categorySlugMap: toCategorySlugMap(site.categorySlugMap),
    defaultCategory: site.defaultCategory,
    domain: site.domain,
    id: site.id,
    isEnabled: site.isEnabled,
    niches: site.niches,
  }));

  const hasFilters = q !== "" || niches.length > 0 || enabled !== "";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-row items-start justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          {hasFilters
            ? `${sites.length} of ${totalCount} sites shown.`
            : `${totalCount} Astro sites under management.`}
        </p>
        <GscBackfillAllButton />
      </div>

      <Suspense fallback={null}>
        <SitesTable initialFilters={{ enabled, niches, q }} nowMs={nowMs} rows={rows} />
      </Suspense>
    </div>
  );
};

const SitesSkeleton = () => (
  <div aria-hidden className="flex flex-col gap-2">
    {[0, 1, 2, 3, 4, 5].map((slot) => (
      <Skeleton className="h-10 w-full" key={slot} />
    ))}
  </div>
);

const SitesPage = ({ searchParams }: { searchParams: Promise<SearchParams> }) => (
  <div className="flex flex-col gap-6">
    <header className="flex flex-col gap-1">
      <h1 className="text-2xl font-semibold tracking-tight">Sites</h1>
      <p className="text-sm text-muted-foreground">
        Astro sites under management, with niches, cadence, and publishing status.
      </p>
      <div className="mt-3">
        <SiteCreateDialog />
      </div>
    </header>

    <Card>
      <CardHeader>
        <CardTitle>
          <h2>All sites</h2>
        </CardTitle>
        <CardDescription>
          Click a row to open insights, or edit niches and status with the inline action.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Suspense fallback={<SitesSkeleton />}>
          <SitesContent searchParams={searchParams} />
        </Suspense>
      </CardContent>
    </Card>
  </div>
);

/** @public Next.js app-router reads the instant segment config via the module loader */
export const instant = true;

export default SitesPage;
