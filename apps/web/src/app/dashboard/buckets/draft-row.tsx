"use client";

import { Button } from "@repo/ui/components/button";
import { Send, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";

import type { ActionResult } from "@/lib/action-result";
import { formatRelativeTime } from "@/lib/relative-time";

import { deleteDraftAction, publishDraftAction } from "./actions";

export type Draft = {
  createdAt: string;
  id: string;
  slug: string;
  title: string;
};

const ARM_WINDOW_MS = 4000;

export const DraftRow = ({ draft, nowMs }: { draft: Draft; nowMs: number }) => {
  const [pending, startTransition] = useTransition();
  const [armed, setArmed] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    if (!armed) {
      return undefined;
    }

    const timer = setTimeout(() => {
      setArmed(false);
    }, ARM_WINDOW_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [armed]);

  const runAction = (action: () => Promise<ActionResult<void>>) => {
    setFailure(null);
    startTransition(async () => {
      const result = await action();

      if (!result.ok) {
        setFailure(result.error);
      }
    });
  };

  const handlePublish = () => {
    runAction(async () => publishDraftAction(draft.id));
  };

  const handleDelete = () => {
    if (!armed) {
      setArmed(true);

      return;
    }

    setArmed(false);
    runAction(async () => deleteDraftAction(draft.id));
  };

  return (
    <li className="flex flex-col gap-1 rounded-md border border-border/60 bg-card/40 px-3 py-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col">
          <Link
            className="truncate text-sm font-medium hover:underline"
            href={`/dashboard/posts/${draft.id}`}
          >
            {draft.title}
          </Link>
          <span className="truncate text-xs text-muted-foreground">
            {draft.slug} · created {formatRelativeTime(new Date(draft.createdAt), nowMs)}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            disabled={pending}
            onClick={handlePublish}
            size="sm"
            type="button"
            variant="ghost"
          >
            <Send aria-hidden="true" className="size-3.5" />
            Publish now
          </Button>
          <Button
            disabled={pending}
            onClick={handleDelete}
            size="sm"
            type="button"
            variant={armed ? "destructive" : "ghost"}
          >
            <Trash2 aria-hidden="true" className="size-3.5" />
            {armed ? "Click to confirm" : ""}
          </Button>
        </div>
      </div>
      {failure === null ? null : (
        <p aria-live="polite" className="text-xs text-destructive">
          {failure}
        </p>
      )}
    </li>
  );
};
