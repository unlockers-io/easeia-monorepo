"use client";

import type { PostStatus } from "@repo/db/browser";
import { Badge } from "@repo/ui/components/badge";
import { CheckCircle2, Clock, FileArchive, PenLine, XCircle } from "lucide-react";

import { describePostState, formatRelativeTime } from "./post-state";
import type { StatusJob } from "./post-state";

type PostStatusBadgeProps = {
  job: StatusJob | null;
  nowMs: number;
  publishedAt: Date | null;
  scheduledAt: Date | null;
  status: PostStatus;
};

export const PostStatusBadge = (props: PostStatusBadgeProps) => {
  const state = describePostState(props);
  const { nowMs } = props;

  if (state.kind === "published") {
    const ago = state.at ? formatRelativeTime(state.at, nowMs) : null;
    return (
      <Badge variant="default">
        <CheckCircle2 aria-hidden="true" className="size-3" />
        {ago !== null && ago !== "" ? `Published ${ago}` : "Published"}
      </Badge>
    );
  }
  if (state.kind === "queued") {
    return (
      <Badge variant="secondary">
        <Clock aria-hidden="true" className="size-3" />
        Scheduled
      </Badge>
    );
  }
  if (state.kind === "overdue") {
    return (
      <Badge variant="destructive">
        <XCircle aria-hidden="true" className="size-3" />
        Overdue
      </Badge>
    );
  }
  if (state.kind === "scheduled") {
    return (
      <Badge variant="secondary">
        <Clock aria-hidden="true" className="size-3" />
        {formatRelativeTime(state.at, nowMs)}
      </Badge>
    );
  }
  if (state.kind === "failed") {
    return (
      <Badge title={state.lastError ?? undefined} variant="destructive">
        <XCircle aria-hidden="true" className="size-3" />
        {state.attempts > 0 ? `Failed · ${state.attempts}×` : "Failed"}
      </Badge>
    );
  }
  if (state.kind === "archived") {
    return (
      <Badge variant="outline">
        <FileArchive aria-hidden="true" className="size-3" />
        Archived
      </Badge>
    );
  }
  return (
    <Badge variant="outline">
      <PenLine aria-hidden="true" className="size-3" />
      Draft
    </Badge>
  );
};
