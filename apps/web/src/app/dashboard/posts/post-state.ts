import { type JobStatus, PostStatus } from "@repo/db/browser";

export type StatusJob = {
  attempts: number;
  lastError: string | null;
  status: JobStatus;
};

export const formatRelativeTime = (date: Date, nowMs: number): string => {
  const deltaMs = date.getTime() - nowMs;
  const future = deltaMs > 0;
  const seconds = Math.abs(deltaMs) / 1000;
  if (seconds < 60) {
    return future ? "in <1m" : "just now";
  }
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60);
    return future ? `in ${m}m` : `${m}m ago`;
  }
  if (seconds < 86_400) {
    const h = Math.floor(seconds / 3600);
    return future ? `in ${h}h` : `${h}h ago`;
  }
  if (seconds < 2_592_000) {
    const d = Math.floor(seconds / 86_400);
    return future ? `in ${d}d` : `${d}d ago`;
  }
  return date.toLocaleDateString("en-US", { timeZone: "UTC" });
};

export type PostState =
  | { at: Date | null; kind: "published" }
  | { at: Date; kind: "overdue" }
  | { at: Date; kind: "scheduled" }
  | { attempts: number; kind: "failed"; lastError: string | null }
  | { kind: "queued" }
  | { kind: "archived" }
  | { at: Date | null; kind: "draft" };

export type DescribePostStateInput = {
  createdAt?: Date | null;
  job?: StatusJob | null;
  nowMs: number;
  publishedAt: Date | null;
  scheduledAt: Date | null;
  status: PostStatus;
};

export const describePostState = ({
  createdAt = null,
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
  return { at: createdAt, kind: "draft" };
};
