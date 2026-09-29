import {
  GoogleNotConfiguredError,
  GoogleNotConnectedError,
  loadConnection,
  pagePerformance,
  resolveSiteUrl,
} from "@repo/search-console";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import { Activity, Search } from "lucide-react";
import Link from "next/link";

import { tryProvider } from "@/app/dashboard/lib/provider-result";
import { buildRedirectUri } from "@/lib/google-oauth";

const WINDOW_DAYS = 28;

const Header = ({ children }: { children: React.ReactNode }) => (
  <CardHeader>
    <CardTitle className="flex items-center gap-2">
      <Activity className="size-4 text-muted-foreground" />
      Search Console: page performance
    </CardTitle>
    <CardDescription>{children}</CardDescription>
  </CardHeader>
);

export const PostSearchConsoleCard = async ({
  domain,
  origin,
  pageUrl,
  userId,
}: {
  domain: string;
  origin: string;
  pageUrl: string;
  userId: string;
}) => {
  const connection = await loadConnection(userId);
  if (!connection) {
    return (
      <Card>
        <Header>
          Connect Google in{" "}
          <Link className="underline" href="/dashboard/settings">
            Settings
          </Link>{" "}
          to see live search performance for this URL.
        </Header>
      </Card>
    );
  }

  const ctx = { redirectUri: buildRedirectUri(origin), userId };
  const resolved = await tryProvider(
    () => resolveSiteUrl(ctx, domain),
    [GoogleNotConnectedError, GoogleNotConfiguredError],
  );
  if (!resolved.ok) {
    return (
      <Card>
        <Header>{resolved.error}</Header>
      </Card>
    );
  }
  if (resolved.data === null || resolved.data === "") {
    return (
      <Card>
        <Header>
          <code className="rounded bg-muted px-1 py-0.5 text-xs">{domain}</code> isn&apos;t a
          verified property in your connected Google account.
        </Header>
      </Card>
    );
  }
  const siteUrl = resolved.data;

  const perf = await pagePerformance(ctx, siteUrl, pageUrl, WINDOW_DAYS);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="size-4 text-muted-foreground" />
          Search Console: page performance
        </CardTitle>
        <CardDescription>
          Last {WINDOW_DAYS} days · property{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">{siteUrl}</code>
        </CardDescription>
      </CardHeader>
      <CardContent>
        {perf ? (
          <dl className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Stat label="Clicks" value={perf.clicks.toLocaleString()} />
            <Stat label="Impressions" value={perf.impressions.toLocaleString()} />
            <Stat label="CTR" value={`${(perf.ctr * 100).toFixed(2)}%`} />
            <Stat label="Avg position" value={perf.position.toFixed(1)} />
          </dl>
        ) : (
          <p className="text-sm text-muted-foreground">
            No Search Console impressions yet for this URL.
          </p>
        )}
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
