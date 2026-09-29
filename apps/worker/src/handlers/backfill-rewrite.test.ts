import { beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  Object.assign(process.env, {
    DATABASE_URL: "postgresql://test:test@localhost:5440/easeia_test",
    REDIS_URL: "redis://localhost:6381",
    WP_ENCRYPTION_KEY: "test-encryption-key",
  });
});

import { createHandleBackfillRewrite, type BackfillRewriteDependencies } from "./backfill-rewrite";

const countEligible = vi.fn<BackfillRewriteDependencies["countEligible"]>();
const enqueueMock = vi.fn<BackfillRewriteDependencies["enqueueJob"]>();
const findEligiblePosts = vi.fn<BackfillRewriteDependencies["findEligiblePosts"]>();
const findMoneySites = vi.fn<BackfillRewriteDependencies["findMoneySites"]>();
const readCountsMock = vi.fn<BackfillRewriteDependencies["readCounts"]>();
const updateJobPayload = vi.fn<BackfillRewriteDependencies["updateJobPayload"]>();
const log = {
  emit: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  set: vi.fn(),
  warn: vi.fn(),
};
const handleBackfillRewrite = createHandleBackfillRewrite({
  countEligible,
  createLogger: () => log,
  enqueueJob: enqueueMock,
  findEligiblePosts,
  findMoneySites,
  readCounts: readCountsMock,
  redisUrl: "redis://localhost:6381",
  settle: async (tasks) => {
    await Promise.allSettled(tasks.map((task) => task.run()));
  },
  updateJobPayload,
});

const STARTED_AT = "2026-07-01T00:00:00.000Z";

const doneCtx = {
  attemptsMade: 0,
  finalAttempt: false,
  jobId: "job_1",
  payload: {
    force: false,
    initialFanoutDone: true,
    initialPostsEligible: 2,
    phase: "REWRITE_POST" as const,
    startedAt: STARTED_AT,
  },
};

describe("handleBackfillRewrite", () => {
  beforeEach(() => {
    enqueueMock.mockClear();
    countEligible.mockReset();
    readCountsMock.mockReset();
    updateJobPayload.mockReset();
    readCountsMock.mockResolvedValue({
      moneySitePagesCrawled: 3,
      moneySitePagesTotal: 3,
      postsEligible: 2,
      postsRewritten: 2,
    });
  });

  it("stops re-enqueueing itself once every phase is complete", async () => {
    await handleBackfillRewrite(doneCtx);

    expect(enqueueMock).not.toHaveBeenCalled();
  });

  it("records the terminal phase on its own row when the chain completes", async () => {
    await handleBackfillRewrite(doneCtx);

    expect(updateJobPayload).toHaveBeenCalledWith("job_1", {
      force: false,
      initialFanoutDone: true,
      initialPostsEligible: 2,
      phase: "DONE",
      startedAt: STARTED_AT,
    });
  });
});
