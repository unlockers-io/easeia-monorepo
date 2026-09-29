import {
  GoogleNotConfiguredError,
  GoogleNotConnectedError,
  loadConnection,
  resolveSiteUrl,
  topQueries,
  totals,
} from "@repo/search-console";
import { Badge } from "@repo/ui/components/badge";
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
import { Activity, MousePointer2, Plug, Search } from "lucide-react";
import Link from "next/link";

import { ProviderErrorCard } from "@/app/dashboard/lib/provider-card";
import { tryProvider } from "@/app/dashboard/lib/provider-result";
import { buildRedirectUri } from "@/lib/google-oauth";

const WINDOW_DAYS = 28;
const TOP_LIMIT = 10;
const TITLE = "Google Search Console";
const SC_DESCRIPTION = "Search Console unavailable.";

const NotConnected = () => (
  <Card>
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <Search className="size-4 text-muted-foreground" />
        {TITLE}
      </CardTitle>
      <CardDescription>
        Connect Google in{" "}
        <Link className="underline" href="/dashboard/settings">
          Settings
        </Link>{" "}
        to surface live clicks, impressions, and ranking data here.
      </CardDescription>
    </CardHeader>
  </Card>
);

const NotVerified = ({ domain }: { domain: string }) => (
  <Card>
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <Search className="size-4 text-muted-foreground" />
        {TITLE}
      </CardTitle>
      <CardDescription>
        <code className="rounded bg-muted px-1 py-0.5 text-xs">{domain}</code> isn&apos;t a verified
        property in your connected Google account.
      </CardDescription>
    </CardHeader>
  </Card>
);

export const SearchConsoleCard = async ({
  domain,
  origin,
  userId,
}: {
  domain: string;
  origin: string;
  userId: string;
}) => {
  const connection = await loadConnection(userId);
  if (!connection) {
    return <NotConnected />;
  }

  const ctx = { redirectUri: buildRedirectUri(origin), userId };
  const resolved = await tryProvider(
    () => resolveSiteUrl(ctx, domain),
    [GoogleNotConnectedError, GoogleNotConfiguredError],
  );
  if (!resolved.ok) {
    return (
      <ProviderErrorCard
        description={SC_DESCRIPTION}
        icon={Plug}
        message={resolved.error}
        title={TITLE}
      />
    );
  }
  if (resolved.data === null || resolved.data === "") {
    return <NotVerified domain={domain} />;
  }
  const siteUrl = resolved.data;

  const fetched = await tryProvider(
    () =>
      Promise.all([
        totals(ctx, siteUrl, WINDOW_DAYS),
        topQueries(ctx, siteUrl, { days: WINDOW_DAYS, limit: TOP_LIMIT }),
      ]),
    [GoogleNotConnectedError, GoogleNotConfiguredError],
  );
  if (!fetched.ok) {
    return (
      <ProviderErrorCard
        description={SC_DESCRIPTION}
        icon={Plug}
        message={fetched.error}
        title={TITLE}
      />
    );
  }
  const [agg, queries] = fetched.data;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="size-4 text-muted-foreground" />
          Google Search Console
        </CardTitle>
        <CardDescription>
          Live performance for{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">{siteUrl}</code> · last{" "}
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
            <p className="text-sm text-muted-foreground">No queries with data in this window.</p>
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
                      <PositionBadge position={q.position} />
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
};

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className="flex flex-col gap-1">
    <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
    <dd className="text-2xl font-semibold tabular-nums">{value}</dd>
  </div>
);

const PositionBadge = ({ position }: { position: number }) => {
  const rounded = position.toFixed(1);
  if (position <= 3) {
    return <Badge variant="default">{rounded}</Badge>;
  }
  if (position <= 10) {
    return <Badge variant="secondary">{rounded}</Badge>;
  }
  return <Badge variant="outline">{rounded}</Badge>;
};
