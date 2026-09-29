"use client";

import { Button } from "@repo/ui/components/button";
import { Send, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";

import { deleteDraftAction, publishDraftAction } from "./actions";

export type Draft = {
  createdAt: string;
  id: string;
  slug: string;
  title: string;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const relativeTime = (iso: string, nowMs: number): string => {
  const diff = nowMs - new Date(iso).getTime();
  if (diff < 0) {
    return new Date(iso).toLocaleString("en-US", { timeZone: "UTC" });
  }
  const days = Math.floor(diff / MS_PER_DAY);
  if (days >= 1) {
    return `${days}d ago`;
  }
  const hours = Math.floor(diff / (60 * 60 * 1000));
  if (hours >= 1) {
    return `${hours}h ago`;
  }
  const minutes = Math.floor(diff / (60 * 1000));
  return `${Math.max(1, minutes)}m ago`;
};

const ARM_WINDOW_MS = 4000;

export const DraftRow = ({ draft, nowMs }: { draft: Draft; nowMs: number }) => {
  const [pending, startTransition] = useTransition();
  const [armed, setArmed] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const runAction = (label: string, action: () => Promise<void>) => {
    setError(null);
    startTransition(async () => {
      try {
        await action();
        // eslint-disable-next-line unicorn/catch-error-name -- `error` shadows the state setter scope
      } catch (thrown) {
        setError(thrown instanceof Error ? thrown.message : `${label} failed`);
      }
    });
  };

  const handlePublish = () => {
    runAction("Publish", async () => {
      const result = await publishDraftAction(draft.id);
      if (!result.ok) {
        setError(result.error);
      }
    });
  };

  const handleDelete = () => {
    if (!armed) {
      setArmed(true);
      return;
    }
    setArmed(false);
    runAction("Delete", () => deleteDraftAction(draft.id));
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
            {draft.slug} · created {relativeTime(draft.createdAt, nowMs)}
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
      {error === null ? null : (
        <p aria-live="polite" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </li>
  );
};
