import type { PostStatus } from "@repo/db";

import { describePostState } from "../post-state";

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

export { JobStatusBadge } from "@/components/job-status-badge";
export { PostTimingLabel };
