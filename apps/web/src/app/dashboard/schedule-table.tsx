import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/table";
import { cn } from "@repo/ui/lib/utils";
import Link from "next/link";

import {
  formatLastPost,
  formatPosition,
  STANDING_FILL,
  STANDING_LABEL,
  STANDING_TEXT,
  standingOf,
  type SiteCardModel,
} from "./site-card-model";

/** Section 02: every enabled site, worst first, with a health bar per row. */
const ScheduleTable = ({ cards }: { cards: ReadonlyArray<SiteCardModel> }) => (
  <Table>
    <TableCaption className="sr-only">All enabled sites sorted by health</TableCaption>
    <TableHeader>
      <TableRow>
        <TableHead className="pl-0 text-right">Health</TableHead>
        <TableHead className="w-35 max-md:hidden" />
        <TableHead>Site</TableHead>
        <TableHead className="max-lg:hidden">Feeds</TableHead>
        <TableHead>Flag</TableHead>
        <TableHead className="text-right max-md:hidden">DR</TableHead>
        <TableHead className="text-right max-md:hidden">Refs</TableHead>
        <TableHead className="text-right max-md:hidden">Pos</TableHead>
        <TableHead className="text-right">Last post</TableHead>
        <TableHead className="pr-0" />
      </TableRow>
    </TableHeader>
    <TableBody>
      {cards.map(({ latest, moneySite, site }) => {
        const standing = standingOf(latest);
        const score = latest?.healthScore;
        return (
          <TableRow key={site.id}>
            <TableCell className="pl-0 text-right">
              <span
                className={`text-xl font-extrabold tracking-display ${STANDING_TEXT[standing]}`}
              >
                {score ?? "—"}
              </span>
            </TableCell>
            <TableCell className="max-md:hidden">
              {score === null || score === undefined ? null : (
                <span
                  aria-hidden="true"
                  className={cn(
                    "schedule-column-width",
                    `inline-block h-2 align-middle ${STANDING_FILL[standing]}`,
                  )}
                  style={{ "--schedule-table-width": `${score}%` }}
                />
              )}
            </TableCell>
            <TableCell className="font-bold">
              <Link
                className="hover:underline hover:underline-offset-4"
                href={`/dashboard/sites/${site.id}`}
              >
                {site.domain}
              </Link>
            </TableCell>
            <TableCell className="text-muted-foreground max-lg:hidden">
              {moneySite?.name ?? "—"}
            </TableCell>
            <TableCell>
              <span
                className={`text-xs font-extrabold tracking-wide uppercase ${STANDING_TEXT[standing]}`}
              >
                {STANDING_LABEL[standing]}
              </span>
            </TableCell>
            <TableCell className="text-right max-md:hidden">{latest?.domainRank ?? "—"}</TableCell>
            <TableCell className="text-right max-md:hidden">
              {latest?.referringDomains?.toLocaleString() ?? "—"}
            </TableCell>
            <TableCell className="text-right max-md:hidden">
              {formatPosition(latest?.gscAvgPosition)}
            </TableCell>
            <TableCell className="text-right text-muted-foreground">
              {formatLastPost(latest?.daysSinceLastPublish)}
            </TableCell>
            <TableCell className="pr-0 text-right">
              <Link
                className="font-bold hover:underline hover:underline-offset-4"
                href={`/dashboard/sites/${site.id}`}
                prefetch
              >
                Open
              </Link>
            </TableCell>
          </TableRow>
        );
      })}
    </TableBody>
  </Table>
);

export { ScheduleTable };
