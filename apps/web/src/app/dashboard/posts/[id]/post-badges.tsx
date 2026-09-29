import { JobStatus } from "@repo/db";
import type { PostStatus } from "@repo/db";
import { Badge } from "@repo/ui/components/badge";
import { CheckCircle2, Clock, Loader2, XCircle } from "lucide-react";

import { describePostState } from "../post-state";

const JobStatusBadge = ({ status }: { status: JobStatus }) => {
  if (status === JobStatus.DONE) {
    return (
      <Badge variant="default">
        <CheckCircle2 aria-hidden="true" className="size-3" />
        Done
      </Badge>
    );
  }
  if (status === JobStatus.FAILED) {
    return (
      <Badge variant="destructive">
        <XCircle aria-hidden="true" className="size-3" />
        Failed
      </Badge>
    );
  }
  if (status === JobStatus.RUNNING) {
    return (
      <Badge variant="secondary">
        <Loader2 aria-hidden="true" className="size-3 motion-safe:animate-spin" />
        Running
      </Badge>
    );
  }
  return (
    <Badge variant="outline">
      <Clock aria-hidden="true" className="size-3" />
      Queued
    </Badge>
  );
};

const at = (d: Date) => new Date(d).toLocaleString();

const PostTimingLabel = ({
  nowMs,
  post,
}: {
  nowMs: number;
  post: { createdAt: Date; publishedAt: Date | null; scheduledAt: Date | null; status: PostStatus };
}) => {
  const state = describePostState({ ...post, nowMs });

  if (state.kind === "published") {
    return state.at ? `Published ${at(state.at)}` : "Published";
  }
  if (state.kind === "overdue") {
    return `Overdue since ${at(state.at)}`;
  }
  if (state.kind === "scheduled") {
    return `Scheduled for ${at(state.at)}`;
  }
  if (state.kind === "queued") {
    return "Queued for publish";
  }
  if (state.kind === "failed") {
    return state.attempts > 0 ? `Failed after ${state.attempts} attempts` : "Failed";
  }
  if (state.kind === "archived") {
    return `Archived · created ${at(post.createdAt)}`;
  }
  return `Created ${at(post.createdAt)}`;
};

export { JobStatusBadge, PostTimingLabel };
