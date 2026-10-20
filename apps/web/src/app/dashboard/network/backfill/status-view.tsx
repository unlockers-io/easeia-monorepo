"use client";
import { Button } from "@repo/ui/components/button";
import { useClientReady } from "@repo/ui/hooks/use-client-ready";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { RunProgress } from "../run-progress";

import type { Status } from "./controller";

const QUERY_KEY = ["backfill-status"] as const;

const POLL_MS = 3000;

export const NetworkBackfillPage = ({
  loadStatus,
  start,
}: {
  loadStatus: () => Promise<Status>;
  start: () => Promise<void>;
}) => {
  const queryClient = useQueryClient();
  const ready = useClientReady();

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
          disabled={!ready || busy || status?.active === true}
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
        <RunProgress
          counts={status.counts}
          ended={status.ended}
          phase={status.phase}
          rows={[
            {
              done: status.counts.classifiedPosts,
              label: "Classify (posts)",
              total: status.counts.posts,
            },
            {
              done: status.counts.embeddedPosts,
              label: "Embed (posts)",
              total: status.counts.posts,
            },
            {
              done: status.counts.suggestDone,
              label: "Suggest links (posts)",
              total: status.counts.posts,
            },
          ]}
        />
      ) : null}
    </section>
  );
};
