import { forSite, GoogleAuthError, GoogleNotConfiguredError } from "@repo/search-console";
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
  pageUrl,
}: {
  domain: string;
  pageUrl: string;
}) => {
  const resolved = await tryProvider(
    () => forSite(domain),
    [GoogleAuthError, GoogleNotConfiguredError],
  );

  if (!resolved.ok) {
    return (
      <Card>
        <Header>{resolved.error}</Header>
      </Card>
    );
  }

  const site = resolved.data;

  if (site.status === "not_connected") {
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

  if (site.status === "not_verified") {
    return (
      <Card>
        <Header>
          <code className="rounded bg-muted px-1 py-0.5 text-xs">{domain}</code> isn&apos;t a
          verified property in your connected Google account.
        </Header>
      </Card>
    );
  }

  const perf = await site.pagePerformance(pageUrl, WINDOW_DAYS);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="size-4 text-muted-foreground" />
          Search Console: page performance
        </CardTitle>
        <CardDescription>
          Last {WINDOW_DAYS} days · property{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">{site.property}</code>
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
