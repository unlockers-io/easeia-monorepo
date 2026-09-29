"use client";
import { Button } from "@repo/ui/components/button";
import { useState } from "react";
import { toast } from "sonner";

import { rewritePostAction } from "@/app/dashboard/network/actions";
import { unwrapAction } from "@/lib/action-result";

type State = { kind: "idle" } | { kind: "pending" } | { kind: "queued" };

const LABELS = {
  idle: "Rewrite this post",
  pending: "…",
  queued: "Queued",
} satisfies Record<State["kind"], string>;

export const RewriteTriggerButton = ({
  aiConfigured = true,
  postId,
}: {
  aiConfigured?: boolean;
  postId: string;
}) => {
  const [state, setState] = useState<State>({ kind: "idle" });

  const handleClick = async () => {
    setState({ kind: "pending" });
    try {
      unwrapAction(await rewritePostAction(postId));
      setState({ kind: "queued" });
    } catch (error) {
      setState({ kind: "idle" });
      toast.error(error instanceof Error ? error.message : "Failed to queue rewrite.");
    }
  };

  return (
    <Button
      aria-busy={state.kind === "pending"}
      disabled={!aiConfigured || state.kind === "pending"}
      onClick={() => {
        void handleClick();
      }}
      size="sm"
      title={
        aiConfigured
          ? undefined
          : "Set OPENAI_API_KEY in the server environment to enable rewrites."
      }
      variant="outline"
    >
      {LABELS[state.kind]}
    </Button>
  );
};
