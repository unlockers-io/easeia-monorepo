import {
  isGoogleConfigured,
  GoogleNotConfiguredError,
  listVerifiedSites,
  loadConnection,
} from "@repo/search-console";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import { CheckCircle2, ExternalLink, Plug, Unplug } from "lucide-react";
import { headers } from "next/headers";

import { getSession } from "@/lib/auth-helpers";
import { buildRedirectUri } from "@/lib/google-oauth";

import { IntegrationsCard } from "./integrations";
import { PasswordForm } from "./password-form";
import { ProfileForm } from "./profile-form";

const ConnectionCard = async ({ origin }: { origin: string }) => {
  const session = await getSession();
  if (!session) {
    return null;
  }
  const userId = session.user.id;
  const connection = await loadConnection(userId);

  if (!connection) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plug className="size-4 text-muted-foreground" />
            Google Search Console
          </CardTitle>
          <CardDescription>
            Connect your Google account to surface live clicks, impressions, and ranking data from
            Search Console next to every Site and Post.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action="/api/google/connect" method="get">
            <Button disabled={!isGoogleConfigured()} type="submit">
              <Plug className="size-4" />
              Connect Google account
            </Button>
          </form>
          {!isGoogleConfigured() && (
            <p className="mt-2 text-sm text-muted-foreground">
              Set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET to connect Google.
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  let verifiedCount: number | null = null;
  let errorMessage: string | null = null;
  try {
    const sites = await listVerifiedSites({
      redirectUri: buildRedirectUri(origin),
      userId,
    });
    verifiedCount = sites.length;
  } catch (error) {
    if (error instanceof GoogleNotConfiguredError) {
      errorMessage = error.message;
    } else {
      errorMessage = error instanceof Error ? error.message : String(error);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle2 className="size-4 text-primary" />
          Google Search Console connected
        </CardTitle>
        <CardDescription>
          {connection.googleEmail !== null && connection.googleEmail !== ""
            ? `Authorized as ${connection.googleEmail}.`
            : "Authorized."}{" "}
          Tokens auto-refresh in the background.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <dl className="grid grid-cols-2 gap-y-3 text-sm">
          <Term label="Verified properties">
            {errorMessage !== null && errorMessage !== "" ? (
              <span className="text-destructive">{errorMessage}</span>
            ) : (
              <Badge variant="secondary">{verifiedCount ?? "—"}</Badge>
            )}
          </Term>
          <Term label="Scope">
            <code className="text-(length:--text-caption-sm)">webmasters.readonly</code>
          </Term>
          <Term label="Access token expires">
            <span className="tabular-nums">{new Date(connection.expiresAt).toLocaleString()}</span>
          </Term>
        </dl>
        <div className="flex items-center gap-2">
          <a
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:underline"
            href="https://search.google.com/search-console"
            rel="noreferrer"
            target="_blank"
          >
            Open Search Console <ExternalLink className="size-3" />
          </a>
          <span className="text-muted-foreground">·</span>
          <form action="/api/google/disconnect" method="post">
            <Button size="sm" type="submit" variant="outline">
              <Unplug className="size-4" />
              Disconnect
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
  );
};

const SettingsPage = async ({
  searchParams,
}: {
  searchParams: Promise<{
    google_connected?: string;
    google_disconnected?: string;
    google_error?: string;
  }>;
}) => {
  const [params, headersList, session] = await Promise.all([searchParams, headers(), getSession()]);
  const host = headersList.get("host") ?? "localhost";
  const proto = headersList.get("x-forwarded-proto") ?? "https";
  const origin = `${proto}://${host}`;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Integrations and account-level preferences.</p>
      </header>

      {params.google_connected !== undefined && params.google_connected !== "" ? (
        <Banner tone="success">Google Search Console connected.</Banner>
      ) : null}
      {params.google_disconnected !== undefined && params.google_disconnected !== "" ? (
        <Banner tone="info">Google Search Console disconnected.</Banner>
      ) : null}
      {params.google_error !== undefined && params.google_error !== "" ? (
        <Banner tone="error">Google connect failed: {params.google_error}</Banner>
      ) : null}

      {session && <ProfileForm email={session.user.email} name={session.user.name} />}
      <PasswordForm />
      <IntegrationsCard />
      <ConnectionCard origin={origin} />
    </div>
  );
};

const TONES = {
  error: "border-destructive/40 bg-destructive/5 text-destructive",
  info: "border-border bg-muted text-foreground",
  success: "border-primary/40 bg-primary/5 text-primary",
} as const;

const Banner = ({ children, tone }: { children: React.ReactNode; tone: keyof typeof TONES }) => (
  <div className={`rounded-md border px-4 py-2 text-sm ${TONES[tone]}`}>{children}</div>
);

const Term = ({ children, label }: { children: React.ReactNode; label: string }) => (
  <>
    <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
    <dd>{children}</dd>
  </>
);

export default SettingsPage;
