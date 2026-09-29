"use client";

import { Button } from "@repo/ui/components/button";
import { Loader2, Sparkles } from "lucide-react";
import { useState, useTransition } from "react";

import { startGscBacklinkBackfillAllAction } from "./actions";

type State =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "done"; queued: number; skipped: number }
  | { kind: "error"; message: string };

export const GscBackfillAllButton = () => {
  const [state, setState] = useState<State>({ kind: "idle" });
  const [pending, startTransition] = useTransition();

  const handleClick = () => {
    setState({ kind: "running" });
    startTransition(async () => {
      const result = await startGscBacklinkBackfillAllAction();
      if (!result.ok) {
        setState({ kind: "error", message: result.error });
        return;
      }
      setState({ kind: "done", queued: result.queued, skipped: result.skipped });
    });
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        disabled={pending || state.kind === "done"}
        onClick={handleClick}
        size="sm"
        type="button"
        variant="outline"
      >
        {pending ? (
          <Loader2 aria-hidden="true" className="size-4 motion-safe:animate-spin" />
        ) : (
          <Sparkles aria-hidden="true" className="size-4" />
        )}
        {state.kind === "done" ? "Backfill queued" : "Backfill GSC backlinks"}
      </Button>
      {state.kind === "done" ? (
        <p aria-live="polite" className="text-xs text-muted-foreground">
          {state.queued} site{state.queued === 1 ? "" : "s"} queued
          {state.skipped > 0 ? ` · ${state.skipped} failed` : ""}. Crawls drip-feed over hours.
        </p>
      ) : null}
      {state.kind === "error" ? (
        <p aria-live="polite" className="text-xs text-destructive">
          {state.message}
        </p>
      ) : null}
    </div>
  );
};
