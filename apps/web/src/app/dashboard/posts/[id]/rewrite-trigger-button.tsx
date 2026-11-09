"use client";

import { Button } from "@repo/ui/components/button";
import { useClientReady } from "@repo/ui/hooks/use-client-ready";
import { useState } from "react";
import { toast } from "sonner";

import { rewritePostAction } from "../actions";

type State = { kind: "idle" } | { kind: "pending" } | { kind: "queued" };

const LABELS = {
  idle: "Rewrite this post",
  pending: "…",
  queued: "Queued",
} satisfies Record<State["kind"], string>;

export const RewriteTriggerButton = ({
  aiConfigured,
  postId,
}: {
  aiConfigured: boolean;
  postId: string;
}) => {
  const [state, setState] = useState<State>({ kind: "idle" });
  const ready = useClientReady();

  const handleClick = async () => {
    setState({ kind: "pending" });
    const result = await rewritePostAction(postId);

    if (!result.ok) {
      setState({ kind: "idle" });
      toast.error(result.error);

      return;
    }

    setState({ kind: "queued" });
  };

  return (
    <Button
      aria-busy={state.kind === "pending"}
      disabled={!ready || !aiConfigured || state.kind === "pending"}
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
