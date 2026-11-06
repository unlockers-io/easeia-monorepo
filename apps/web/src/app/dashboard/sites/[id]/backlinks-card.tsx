import { externalBacklinkSummary, pbnBacklinkSummary } from "@repo/links";
import { isConnected } from "@repo/search-console";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";

import { Stat } from "@/app/dashboard/lib/metrics";

import { ExternalBacklinksUpload } from "./external-backlinks-upload";

export const BacklinksCard = async ({ siteId }: { siteId: string }) => {
  const [pbn, external, googleConnected] = await Promise.all([
    pbnBacklinkSummary(siteId),
    externalBacklinkSummary(siteId),
    isConnected(),
  ]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Backlinks</h2>
        </CardTitle>
        <CardDescription>
          Internal PBN links from our own Link table, plus external (off-network) backlinks ingested
          from a Google Search Console CSV export.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-medium text-muted-foreground">Internal (PBN)</h3>
          <dl className="grid grid-cols-2 gap-4 text-sm md:grid-cols-3">
            <Stat label="Backlinks" value={pbn.backlinks.toLocaleString()} />
            <Stat label="Referring sites" value={pbn.referringSites.toLocaleString()} />
            <Stat label="Referring posts" value={pbn.referringPosts.toLocaleString()} />
          </dl>
        </div>

        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-medium text-muted-foreground">External (GSC)</h3>
          {external.referringDomains === 0 ? (
            <p className="text-sm text-muted-foreground">
              Upload a GSC Links CSV or click &ldquo;Auto-import from Search Console&rdquo; below to
              populate.
            </p>
          ) : (
            <dl className="grid grid-cols-2 gap-4 text-sm md:grid-cols-3">
              <Stat label="Linking pages" value={external.linkingPages.toLocaleString()} />
              <Stat label="Referring domains" value={external.referringDomains.toLocaleString()} />
              <Stat
                label="Last import"
                value={external.lastImportedAt?.toLocaleDateString() ?? "never"}
              />
            </dl>
          )}
          {external.recentReferringUrls.length > 0 ? (
            <div className="flex flex-col gap-1 border-t pt-2">
              <p className="text-xs font-medium text-muted-foreground">
                Latest referring URLs from Search Console
              </p>
              <ul className="flex max-h-80 flex-col gap-1 overflow-y-auto text-sm">
                {external.recentReferringUrls.map((s) => (
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

        <ExternalBacklinksUpload hasGoogleConnection={googleConnected} siteId={siteId} />
      </CardContent>
    </Card>
  );
};
