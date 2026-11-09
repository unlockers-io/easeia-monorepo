"use client";

import { Checkbox } from "@repo/ui/components/checkbox";
import { useClientReady } from "@repo/ui/hooks/use-client-ready";
import { useId, useState } from "react";

import { readRewriteStatusAction, startRewriteAction } from "../actions";
import { RunPanel } from "../run-panel";

const Page = () => {
  const [force, setForce] = useState(false);
  const ready = useClientReady();
  const forceId = useId();

  return (
    <RunPanel
      description="Rewrites every published post on every PBN site with voice + SEO + humanizer prompts. Weaves in 3 internal/PBN suggested links + 2 money-site pages. Publishes to Astro."
      loadStatus={readRewriteStatusAction}
      pollMs={5000}
      queryKey="rewrite-status"
      rows={(counts) => [
        {
          done: counts.moneySitePagesCrawled,
          label: "Money-site catalog (pages)",
          total: counts.moneySitePagesTotal,
        },
        { done: counts.postsRewritten, label: "Posts rewritten", total: counts.postsEligible },
      ]}
      runLabel="Run network rewrite"
      start={async () => startRewriteAction(force)}
      title="Network rewrite"
    >
      <div className="flex items-center gap-2 text-sm">
        <Checkbox checked={force} disabled={!ready} id={forceId} onCheckedChange={setForce} />
        <label htmlFor={forceId}>force re-rewrite of already-rewritten posts</label>
      </div>
    </RunPanel>
  );
};

export default Page;
