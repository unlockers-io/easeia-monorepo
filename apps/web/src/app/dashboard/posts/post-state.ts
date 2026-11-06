import { PostStatus } from "@repo/db/browser";

export type StatusJob = {
  attempts: number;
  lastError: string | null;
};

export type PostState =
  | { at: Date | null; kind: "published" }
  | { at: Date; kind: "overdue" }
  | { at: Date; kind: "scheduled" }
  | { attempts: number; kind: "failed"; lastError: string | null }
  | { kind: "queued" }
  | { kind: "archived" }
  | { kind: "draft" };

type DescribePostStateInput = {
  job?: StatusJob | null;
  nowMs: number;
  publishedAt: Date | null;
  scheduledAt: Date | null;
  status: PostStatus;
};

export const describePostState = ({
  job = null,
  nowMs,
  publishedAt,
  scheduledAt,
  status,
}: DescribePostStateInput): PostState => {
  if (status === PostStatus.PUBLISHED) {
    return { at: publishedAt, kind: "published" };
  }

  if (status === PostStatus.SCHEDULED) {
    if (!scheduledAt) {
      return { kind: "queued" };
    }

    return scheduledAt.getTime() <= nowMs
      ? { at: scheduledAt, kind: "overdue" }
      : { at: scheduledAt, kind: "scheduled" };
  }

  if (status === PostStatus.FAILED) {
    return { attempts: job?.attempts ?? 0, kind: "failed", lastError: job?.lastError ?? null };
  }

  if (status === PostStatus.ARCHIVED) {
    return { kind: "archived" };
  }

  return { kind: "draft" };
};
