import { PostStatus } from "@repo/db/browser";
import { describe, expect, it } from "vitest";

import { describePostState } from "./post-state";

const NOW = new Date("2026-08-15T12:00:00.000Z").getTime();
const PAST = new Date("2026-08-14T12:00:00.000Z");
const FUTURE = new Date("2026-08-16T12:00:00.000Z");

const decode = (over: Partial<Parameters<typeof describePostState>[0]> = {}) =>
  describePostState({
    nowMs: NOW,
    publishedAt: null,
    scheduledAt: null,
    status: PostStatus.DRAFT,
    ...over,
  });

describe("describePostState", () => {
  it("reports a past scheduledAt as overdue", () => {
    expect(decode({ scheduledAt: PAST, status: PostStatus.SCHEDULED }).kind).toBe("overdue");
  });

  it("reports a future scheduledAt as scheduled", () => {
    expect(decode({ scheduledAt: FUTURE, status: PostStatus.SCHEDULED }).kind).toBe("scheduled");
  });

  it("reports SCHEDULED with no scheduledAt as queued", () => {
    expect(decode({ status: PostStatus.SCHEDULED }).kind).toBe("queued");
  });

  // publishedAt survives republish, archive and fail, so status has to win or
  // the UI renders "Published <old date>" beside a contradicting badge.
  it.each([
    [PostStatus.SCHEDULED, "overdue"],
    [PostStatus.ARCHIVED, "archived"],
    [PostStatus.FAILED, "failed"],
    [PostStatus.DRAFT, "draft"],
  ])("does not let a stale publishedAt outrank %s", (status, expected) => {
    const result = decode({ publishedAt: PAST, scheduledAt: PAST, status });

    expect(result.kind).toBe(expected);
  });

  it("keeps PUBLISHED with a null publishedAt renderable", () => {
    const result = decode({ status: PostStatus.PUBLISHED });

    expect(result).toEqual({ at: null, kind: "published" });
  });

  it("carries the failing job's attempts and error", () => {
    const result = decode({
      job: { attempts: 3, lastError: "boom", status: "FAILED" },
      status: PostStatus.FAILED,
    });

    expect(result).toEqual({ attempts: 3, kind: "failed", lastError: "boom" });
  });
});
