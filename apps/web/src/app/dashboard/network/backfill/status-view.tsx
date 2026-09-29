"use client";
import { Button } from "@repo/ui/components/button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import type { Status } from "./controller";

const QUERY_KEY = ["backfill-status"] as const;

const POLL_MS = 3000;

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

export const NetworkBackfillPage = ({
  loadStatus,
  start,
}: {
  loadStatus: () => Promise<Status>;
  start: () => Promise<void>;
}) => {
  const queryClient = useQueryClient();

  const { data: status, isError } = useQuery({
    queryFn: loadStatus,
    queryKey: QUERY_KEY,
    refetchInterval: POLL_MS,
  });

  const { isPending: busy, mutate: runBackfill } = useMutation({
    mutationFn: start,
    onError: () => {
      toast.error("Failed to start network backfill. Please try again.");
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });

  return (
    <section className="max-w-2xl p-6">
      <h1 className="text-2xl font-semibold">Network backfill</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Classifies and embeds every published post, then writes suggested internal + PBN links for
        review.
      </p>

      <div className="mt-6">
        <Button
          disabled={busy || status?.active === true}
          onClick={() => {
            runBackfill();
          }}
        >
          {status?.active === true ? "Running…" : "Run network backfill"}
        </Button>
      </div>

      {isError ? (
        <p className="mt-4 text-sm text-destructive">
          Failed to load backfill status. Retrying automatically…
        </p>
      ) : null}

      {status?.counts ? (
        <div className="mt-6 rounded border p-4">
          <div className="mb-2 text-sm font-medium">Phase: {status.phase}</div>
          <Row
            done={status.counts.classifiedPosts}
            label="Classify (posts)"
            total={status.counts.posts}
          />
          <Row
            done={status.counts.embeddedPosts}
            label="Embed (posts)"
            total={status.counts.posts}
          />
          <Row
            done={status.counts.suggestDone}
            label="Suggest links (posts)"
            total={status.counts.posts}
          />
          {status.counts.failed > 0 ? (
            <div className="mt-2 text-sm text-destructive">Failed jobs: {status.counts.failed}</div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
};
