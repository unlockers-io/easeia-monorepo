import { describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  Object.assign(process.env, {
    BETTER_AUTH_SECRET: "test-secret-that-is-at-least-32-characters",
    DATABASE_URL: "postgresql://test:test@localhost:5440/easeia_test",
    FROM_EMAIL: "test@easeia.dev",
    REDIS_URL: "redis://localhost:6381",
    WP_ENCRYPTION_KEY: "test-encryption-key",
  });
});

import { createBackfillRoutes } from "./backfill";
import { allowAction, bypassMiddleware } from "./test-harness";

const enqueueMock = vi.fn(() => Promise.resolve({ id: "job_1", queueJobId: undefined }));
const backfillRoutes = createBackfillRoutes({
  apiAuth: bypassMiddleware,
  audit: () => Promise.resolve(),
  enqueueJob: enqueueMock,
  getRedisUrl: () => "redis://test",
  rateLimit: bypassMiddleware,
  readStatus: () => Promise.resolve({ active: false }),
  requirePermission: allowAction,
});

describe("POST /network", () => {
  it("enqueues the orchestrator at the worker's real initial phase", async () => {
    const res = await backfillRoutes.request("/network", { method: "POST" });
    expect(res.status).toBe(202);
    expect(enqueueMock).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "BACKFILL_NETWORK",
        payload: expect.objectContaining({ phase: "CLASSIFY_EMBED" }),
      }),
    );
  });
});
