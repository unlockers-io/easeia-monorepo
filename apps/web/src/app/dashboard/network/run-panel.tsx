"use client";

import { Button } from "@repo/ui/components/button";
import { useClientReady } from "@repo/ui/hooks/use-client-ready";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { toast } from "sonner";

import { type ActionResult, unwrapAction } from "@/lib/action-result";

type Counts = { failed: number; skipped: number };

type RunStatus<C extends Counts> = {
  active: boolean;
  counts?: C;
  ended?: "done" | "failed" | null;
  phase?: string;
};

type Row = { done: number; label: string; total: number };

type Props<C extends Counts> = {
  children?: ReactNode;
  description: string;
  loadStatus: () => Promise<ActionResult<RunStatus<C>>>;
  pollMs: number;
  queryKey: string;
  rows: (counts: C) => ReadonlyArray<Row>;
  runLabel: string;
  start: () => Promise<ActionResult<unknown>>;
  title: string;
};

export const RunPanel = <C extends Counts>({
  children,
  description,
  loadStatus,
  pollMs,
  queryKey,
  rows,
  runLabel,
  start,
  title,
}: Props<C>) => {
  const queryClient = useQueryClient();
  const ready = useClientReady();

  const { data: status, error } = useQuery({
    queryFn: async () => unwrapAction(await loadStatus()),
    queryKey: [queryKey],
    refetchInterval: pollMs,
  });

  const { isPending: busy, mutate: run } = useMutation({
    mutationFn: async () => unwrapAction(await start()),
    onError: (startError) => {
      toast.error(startError.message);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [queryKey] });
    },
  });

  return (
    <section className="max-w-2xl p-6">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>

      <div className="mt-6 flex items-center gap-3">
        <Button
          disabled={!ready || busy || status?.active === true}
          onClick={() => {
            run();
          }}
        >
          {status?.active === true ? "Running…" : runLabel}
        </Button>
        {children}
      </div>

      {error === null ? null : (
        <p className="mt-4 text-sm text-destructive">{error.message} Retrying automatically…</p>
      )}

      {status?.counts ? (
        <RunProgress counts={status.counts} ended={status.ended} phase={status.phase} rows={rows} />
      ) : null}
    </section>
  );
};

type RunProgressProps<C extends Counts> = {
  counts: C;
  ended: RunStatus<C>["ended"];
  phase: RunStatus<C>["phase"];
  rows: Props<C>["rows"];
};

const RunProgress = <C extends Counts>({ counts, ended, phase, rows }: RunProgressProps<C>) => (
  <div className="mt-6 rounded border p-4">
    <div className="mb-2 text-sm font-medium">
      Phase: {phase}
      {ended ? ` (${ended})` : ""}
    </div>
    {rows(counts).map(({ done, label, total }) => (
      <div className="flex items-baseline justify-between gap-4 py-1" key={label}>
        <span className="text-sm">{label}</span>
        <span className="font-mono text-sm tabular-nums">
          {done} / {total} ({total === 0 ? 0 : Math.round((done / total) * 100)}%)
        </span>
      </div>
    ))}
    {counts.skipped > 0 ? (
      <p className="mt-2 text-sm text-muted-foreground">Skipped jobs: {counts.skipped}</p>
    ) : null}
    {counts.failed > 0 ? (
      <div className="mt-2 text-sm text-destructive">Failed jobs: {counts.failed}</div>
    ) : null}
  </div>
);
