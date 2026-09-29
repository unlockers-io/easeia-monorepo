"use client";
import { Button } from "@repo/ui/components/button";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { recrawlMoneySiteAction } from "@/app/dashboard/money-sites/actions";
import { unwrapAction } from "@/lib/action-result";
import { runWithCleanup } from "@/lib/run-with-cleanup";

type State = { kind: "idle" } | { kind: "pending" };

export const RecrawlMoneySiteButton = ({ id }: { id: string }) => {
  const [state, setState] = useState<State>({ kind: "idle" });
  const { refresh } = useRouter();

  const handleClick = async () => {
    setState({ kind: "pending" });
    await runWithCleanup(
      async () => {
        try {
          unwrapAction(await recrawlMoneySiteAction(id));
          toast.success("Re-crawl queued.");
          refresh();
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "Failed to trigger re-crawl.");
        }
      },
      () => {
        setState({ kind: "idle" });
      },
    );
  };

  return (
    <Button
      aria-busy={state.kind === "pending"}
      disabled={state.kind === "pending"}
      onClick={() => {
        void handleClick();
      }}
      size="sm"
      variant="outline"
    >
      {state.kind === "pending" ? "Queueing…" : "Re-crawl"}
    </Button>
  );
};
