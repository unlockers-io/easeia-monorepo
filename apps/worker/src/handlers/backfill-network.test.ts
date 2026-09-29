import type { Prisma } from "@repo/db";
import { getJobPayload, JobKind } from "@repo/jobs";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  Object.assign(process.env, {
    DATABASE_URL: "postgresql://test:test@localhost:5440/easeia_test",
    REDIS_URL: "redis://localhost:6381",
    WP_ENCRYPTION_KEY: "test-encryption-key",
  });
});

import { createHandleBackfillNetwork, type BackfillNetworkDependencies } from "./backfill-network";

const enqueueMock = vi.fn<BackfillNetworkDependencies["enqueueJob"]>();
const findPublishedPosts = vi.fn<BackfillNetworkDependencies["findPublishedPosts"]>();
const readCountsMock = vi.fn<BackfillNetworkDependencies["readCounts"]>();
const updateJobPayload = vi.fn<BackfillNetworkDependencies["updateJobPayload"]>();
const log = {
  emit: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  set: vi.fn(),
  warn: vi.fn(),
};
const handleBackfillNetwork = createHandleBackfillNetwork({
  createLogger: () => log,
  enqueueJob: enqueueMock,
  findPublishedPosts,
  readCounts: readCountsMock,
  redisUrl: "redis://localhost:6381",
  settle: async (tasks) => {
    await Promise.allSettled(tasks.map((task) => task.run()));
  },
  updateJobPayload,
});

const STARTED_AT = "2026-07-01T00:00:00.000Z";

const ctxFor = (payload: Prisma.JsonValue) => ({
  attemptsMade: 0,
  finalAttempt: false,
  jobId: "job_1",
  payload: getJobPayload(JobKind.BACKFILL_NETWORK, payload),
});

describe("handleBackfillNetwork", () => {
  beforeEach(() => {
    enqueueMock.mockClear();
    findPublishedPosts.mockReset();
    readCountsMock.mockReset();
    updateJobPayload.mockReset();
  });

  it("fans out CLASSIFY + EMBED for every published post on the first tick", async () => {
    findPublishedPosts.mockResolvedValue([{ id: "p1" }, { id: "p2" }]);

    await handleBackfillNetwork(ctxFor({ phase: "CLASSIFY_EMBED", startedAt: STARTED_AT }));

    const kinds = enqueueMock.mock.calls.map(([input]) => input.kind);
    expect(kinds.filter((k) => k === "CLASSIFY")).toHaveLength(2);
    expect(kinds.filter((k) => k === "EMBED")).toHaveLength(2);
    expect(enqueueMock).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "BACKFILL_NETWORK",
        payload: expect.objectContaining({ initialFanoutDone: true, phase: "CLASSIFY_EMBED" }),
      }),
    );
  });

  it("stops re-enqueueing itself once every phase is complete", async () => {
    readCountsMock.mockResolvedValue({
      classifiedPosts: 2,
      embeddedPosts: 2,
      posts: 2,
      suggestLinksDone: 2,
    });

    await handleBackfillNetwork(
      ctxFor({ initialFanoutDone: true, phase: "SUGGEST_LINKS", startedAt: STARTED_AT }),
    );

    expect(enqueueMock).not.toHaveBeenCalled();
  });

  it("records the terminal phase on its own row when the chain completes", async () => {
    readCountsMock.mockResolvedValue({
      classifiedPosts: 2,
      embeddedPosts: 2,
      posts: 2,
      suggestLinksDone: 2,
    });

    await handleBackfillNetwork(
      ctxFor({ initialFanoutDone: true, phase: "SUGGEST_LINKS", startedAt: STARTED_AT }),
    );

    expect(updateJobPayload).toHaveBeenCalledWith("job_1", {
      initialFanoutDone: true,
      phase: "DONE",
      startedAt: STARTED_AT,
    });
  });

  it("ends the orchestrator chain for a legacy payload with a retired phase", async () => {
    await handleBackfillNetwork(ctxFor({ phase: "SYNC", startedAt: STARTED_AT }));

    expect(enqueueMock).not.toHaveBeenCalled();
    expect(findPublishedPosts).not.toHaveBeenCalled();
    expect(updateJobPayload).toHaveBeenCalledWith("job_1", {
      initialFanoutDone: true,
      phase: "DONE",
      startedAt: STARTED_AT,
    });
  });
});
