import { forSite, GoogleAuthError, GoogleNotConfiguredError } from "@repo/search-console";
import { Card, CardDescription, CardHeader, CardTitle } from "@repo/ui/components/card";
import { Search } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { tryProvider } from "./provider-result";
import { SearchConsoleError } from "./search-console-error";

type ConnectedSite = Extract<Awaited<ReturnType<typeof forSite>>, { status: "ok" }>;

type Gate = { domain: string; purpose: string; title: string };

export const searchConsoleCall = async <T,>(call: () => Promise<T>) =>
  tryProvider(call, [GoogleAuthError, GoogleNotConfiguredError]);

const GateCard = ({ children, title }: { children: ReactNode; title: string }) => (
  <Card>
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <Search className="size-4 text-muted-foreground" />
        {title}
      </CardTitle>
      <CardDescription>{children}</CardDescription>
    </CardHeader>
  </Card>
);

export const withSearchConsole = async (
  { domain, purpose, title }: Gate,
  render: (site: ConnectedSite) => Promise<ReactNode>,
): Promise<ReactNode> => {
  const resolved = await searchConsoleCall(() => forSite(domain));

  if (!resolved.ok) {
    return <SearchConsoleError message={resolved.error} title={title} />;
  }

  const site = resolved.data;

  if (site.status === "not_connected") {
    return (
      <GateCard title={title}>
        Connect Google in{" "}
        <Link className="underline" href="/dashboard/settings">
          Settings
        </Link>{" "}
        {purpose}
      </GateCard>
    );
  }

  if (site.status === "not_verified") {
    return (
      <GateCard title={title}>
        <code className="rounded bg-muted px-1 py-0.5 text-xs">{domain}</code> isn&apos;t a verified
        property in your connected Google account.
      </GateCard>
    );
  }

  return render(site);
};
