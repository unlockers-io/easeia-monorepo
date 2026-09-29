"use client";
import { Button } from "@repo/ui/components/button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import type { Status } from "./controller";

const QUERY_KEY = ["rewrite-status"] as const;

const POLL_MS = 5000;

const Row = ({ done, label, total }: { done: number; label: string; total: number }) => {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return (
    <div className="flex items-baseline justify-between gap-4 py-1">
      <span className="text-sm">{label}</span>
      <span className="font-mono text-sm tabular-nums">
        {done} / {total} ({pct}%)
      </span>
    </div>
  );
};

export const NetworkRewritePage = ({
  loadStatus,
  start,
}: {
  loadStatus: () => Promise<Status>;
  start: (force: boolean) => Promise<void>;
}) => {
  const queryClient = useQueryClient();
  const [force, setForce] = useState(false);

  const { data: status, isError } = useQuery({
    queryFn: loadStatus,
    queryKey: QUERY_KEY,
    refetchInterval: POLL_MS,
  });

  const { isPending: busy, mutate: runRewrite } = useMutation({
    mutationFn: () => start(force),
    onError: () => {
      toast.error("Failed to start network rewrite. Please try again.");
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });

  return (
    <section className="max-w-2xl p-6">
      <h1 className="text-2xl font-semibold">Network rewrite</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Rewrites every published post on every PBN site with voice + SEO + humanizer prompts. Weaves
        in 3 internal/PBN suggested links + 2 money-site pages. Publishes to Astro.
      </p>

      <div className="mt-6 flex items-center gap-3">
        <Button
          disabled={busy || status?.active === true}
          onClick={() => {
            runRewrite();
          }}
        >
          {status?.active === true ? "Running…" : "Run network rewrite"}
        </Button>
        <label className="flex items-center gap-2 text-sm">
          <input
            checked={force}
            onChange={(e) => {
              setForce(e.target.checked);
            }}
            type="checkbox"
          />
          force re-rewrite of already-rewritten posts
        </label>
      </div>

      {isError ? (
        <p className="mt-4 text-sm text-destructive">
          Failed to load rewrite status. Retrying automatically…
        </p>
      ) : null}

      {status?.counts ? (
        <div className="mt-6 rounded border p-4">
          <div className="mb-2 text-sm font-medium">Phase: {status.phase}</div>
          <Row
            done={status.counts.moneySitePagesCrawled}
            label="Money-site catalog (pages)"
            total={status.counts.moneySitePagesTotal}
          />
          <Row
            done={status.counts.postsRewritten}
            label="Posts rewritten"
            total={status.counts.postsEligible}
          />
          {status.counts.failed > 0 ? (
            <div className="mt-2 text-sm text-destructive">Failed jobs: {status.counts.failed}</div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
};
