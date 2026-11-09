import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/table";
import { Activity, MousePointer2 } from "lucide-react";

import { RankBadge, Stat } from "@/app/dashboard/lib/metrics";
import { searchConsoleCall, withSearchConsole } from "@/app/dashboard/lib/search-console";
import { SearchConsoleError } from "@/app/dashboard/lib/search-console-error";

const WINDOW_DAYS = 28;
const TOP_LIMIT = 10;
const TITLE = "Google Search Console";

export const SearchConsoleCard = async ({ domain }: { domain: string }) =>
  withSearchConsole(
    {
      domain,
      purpose: "to surface live clicks, impressions, and ranking data here.",
      title: TITLE,
    },
    async (site) => {
      const fetched = await searchConsoleCall(() =>
        Promise.all([
          site.totals(WINDOW_DAYS),
          site.topQueries({ days: WINDOW_DAYS, limit: TOP_LIMIT }),
        ]),
      );

      if (!fetched.ok) {
        return <SearchConsoleError message={fetched.error} title={TITLE} />;
      }

      const [agg, queries] = fetched.data;

      return (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="size-4 text-muted-foreground" />
              {TITLE}
            </CardTitle>
            <CardDescription>
              Live performance for{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">{site.property}</code> · last{" "}
              {WINDOW_DAYS} days.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            {agg === null ? (
              <p className="text-sm text-muted-foreground">
                No search data for this property in the last {WINDOW_DAYS} days.
              </p>
            ) : (
              <dl className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <Stat label="Clicks" value={agg.clicks.toLocaleString()} />
                <Stat label="Impressions" value={agg.impressions.toLocaleString()} />
                <Stat label="CTR" value={`${(agg.ctr * 100).toFixed(2)}%`} />
                <Stat label="Avg position" value={agg.position.toFixed(1)} />
              </dl>
            )}
            <div>
              <p className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <MousePointer2 className="size-3.5" />
                Top queries
              </p>
              {queries.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No queries with data in this window.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Query</TableHead>
                      <TableHead className="text-right">Clicks</TableHead>
                      <TableHead className="text-right">Impr.</TableHead>
                      <TableHead className="text-right">CTR</TableHead>
                      <TableHead className="text-right">Pos.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {queries.map((q) => (
                      <TableRow key={q.query}>
                        <TableCell className="text-sm">{q.query}</TableCell>
                        <TableCell className="text-right text-xs tabular-nums">
                          {q.clicks.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right text-xs tabular-nums">
                          {q.impressions.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right text-xs tabular-nums">
                          {(q.ctr * 100).toFixed(1)}%
                        </TableCell>
                        <TableCell className="text-right">
                          <RankBadge rank={q.position}>{q.position.toFixed(1)}</RankBadge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </CardContent>
        </Card>
      );
    },
  );
