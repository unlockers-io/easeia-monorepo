import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import { Search } from "lucide-react";

import { Stat } from "@/app/dashboard/lib/metrics";
import { searchConsoleCall, withSearchConsole } from "@/app/dashboard/lib/search-console";
import { SearchConsoleError } from "@/app/dashboard/lib/search-console-error";

const WINDOW_DAYS = 28;
const TITLE = "Search Console: page performance";

export const PostSearchConsoleCard = async ({
  domain,
  pageUrl,
}: {
  domain: string;
  pageUrl: string;
}) =>
  withSearchConsole(
    { domain, purpose: "to see live search performance for this URL.", title: TITLE },
    async (site) => {
      const fetched = await searchConsoleCall(() => site.pagePerformance(pageUrl, WINDOW_DAYS));

      if (!fetched.ok) {
        return <SearchConsoleError message={fetched.error} title={TITLE} />;
      }

      const perf = fetched.data;

      return (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="size-4 text-muted-foreground" />
              {TITLE}
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
    },
  );
