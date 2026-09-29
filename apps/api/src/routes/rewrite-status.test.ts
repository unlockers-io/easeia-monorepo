import { JobKind, JobStatus, type Prisma } from "@repo/db";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

vi.hoisted(() => {
  Object.assign(process.env, {
    BETTER_AUTH_SECRET: "test-secret-that-is-at-least-32-characters",
    DATABASE_URL: "postgresql://test:test@localhost:5440/easeia_test",
    FROM_EMAIL: "test@easeia.dev",
    REDIS_URL: "redis://localhost:6381",
    WP_ENCRYPTION_KEY: "test-encryption-key",
  });
});

import { createOrchestratorStatusReader, type OrchestratorStatusDependencies } from "@repo/jobs";

import { createRewriteRoutes } from "./rewrite";
import { allowAction, bypassMiddleware } from "./test-harness";

const TOTAL_PUBLISHED = 100;
const STILL_UNREWRITTEN = 42;
const REWRITTEN_THIS_RUN = 3;

const countFailed = vi.fn<OrchestratorStatusDependencies["countFailed"]>();
const findLatest = vi.fn<OrchestratorStatusDependencies["findLatest"]>();
const countEligible = vi.fn(() => Promise.resolve(STILL_UNREWRITTEN));

const readStatus = createOrchestratorStatusReader({ countFailed, findLatest })({
  failureKinds: [
    JobKind.BACKFILL_REWRITE,
    JobKind.CRAWL_MONEY_SITE,
    JobKind.CRAWL_MONEY_SITE_PAGE,
    JobKind.REWRITE_POST,
  ],
  fallbackPhase: "CRAWL_MONEY_SITE",
  kind: JobKind.BACKFILL_REWRITE,
  loadCounts: async ({ payload }) => {
    const postsEligible =
      typeof payload.initialPostsEligible === "number"
        ? payload.initialPostsEligible
        : await countEligible();
    return {
      moneySitePagesCrawled: 40,
      moneySitePagesTotal: 40,
      postsEligible,
      postsRewritten: REWRITTEN_THIS_RUN,
      totalPublished: TOTAL_PUBLISHED,
    };
  },
});

const rewriteRoutes = createRewriteRoutes({
  apiAuth: bypassMiddleware,
  audit: () => Promise.resolve(),
  enqueueJob: vi.fn(),
  getRedisUrl: () => "redis://test",
  rateLimit: bypassMiddleware,
  readStatus,
  requirePermission: allowAction,
});

const statusBodySchema = z.object({
  active: z.boolean(),
  counts: z.object({ postsEligible: z.number() }),
  ended: z.enum(["done", "failed"]).nullable(),
  startedAt: z.iso.datetime(),
});

const stubRun = (input: {
  initialPostsEligible?: number;
  phase: string;
  startedAt?: string | null;
  status?: JobStatus;
}) => {
  countFailed.mockResolvedValue(0);
  const payload: Prisma.JsonObject = {
    force: false,
    initialFanoutDone: true,
    initialPostsEligible: input.initialPostsEligible ?? null,
    phase: input.phase,
    startedAt: input.startedAt ?? null,
  };
  findLatest.mockResolvedValue({
    createdAt: new Date("2026-07-01T00:00:00.000Z"),
    payload,
    status: input.status ?? JobStatus.RUNNING,
  });
};

const requestStatus = async () => {
  const response = await rewriteRoutes.request("/status");
  expect(response.status).toBe(200);
  return statusBodySchema.parse(await response.json());
};

const runWithStatus = (status: JobStatus, phase: string) => {
  stubRun({
    initialPostsEligible: 7,
    phase,
    startedAt: "2026-07-01T00:00:00.000Z",
    status,
  });
  return requestStatus();
};

describe("GET /status", () => {
  it("reports the orchestrator's snapshotted denominator", async () => {
    stubRun({
      initialPostsEligible: 7,
      phase: "REWRITE_POST",
      startedAt: "2026-07-01T00:00:00.000Z",
    });

    const body = await requestStatus();

    expect(body.counts.postsEligible).toBe(7);
  });

  it("falls back to createdAt when stored startedAt is null", async () => {
    stubRun({ initialPostsEligible: 7, phase: "REWRITE_POST", startedAt: null });

    const body = await requestStatus();

    expect(body.startedAt).toBe("2026-07-01T00:00:00.000Z");
    expect(countFailed).toHaveBeenCalledWith(
      expect.objectContaining({ startedAt: new Date("2026-07-01T00:00:00.000Z") }),
    );
  });

  it("reports a failed chain as inactive", async () => {
    await expect(runWithStatus(JobStatus.FAILED, "REWRITE_POST")).resolves.toEqual(
      expect.objectContaining({ active: false, ended: "failed" }),
    );
  });

  it("keeps a queued retry active", async () => {
    await expect(runWithStatus(JobStatus.QUEUED, "REWRITE_POST")).resolves.toEqual(
      expect.objectContaining({ active: true, ended: null }),
    );
  });

  it("keeps a running tick active", async () => {
    await expect(runWithStatus(JobStatus.RUNNING, "CRAWL_MONEY_SITE")).resolves.toEqual(
      expect.objectContaining({ active: true, ended: null }),
    );
  });

  it("reports a completed run as done", async () => {
    await expect(runWithStatus(JobStatus.DONE, "DONE")).resolves.toEqual(
      expect.objectContaining({ active: false, ended: "done" }),
    );
  });

  it("scopes the failure count to this pipeline's job kinds", async () => {
    await runWithStatus(JobStatus.RUNNING, "REWRITE_POST");

    expect(countFailed).toHaveBeenCalledWith(
      expect.objectContaining({ failureKinds: expect.arrayContaining([JobKind.REWRITE_POST]) }),
    );
  });

  it("falls back to the live unrewritten count for a legacy payload", async () => {
    stubRun({ phase: "REWRITE_POST", startedAt: "2026-07-01T00:00:00.000Z" });

    const body = await requestStatus();

    expect(body.counts.postsEligible).toBe(STILL_UNREWRITTEN);
  });
});
