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

import { BackfillAlreadyRunningError } from "@repo/backfill";

import { createBackfillRoutes } from "./backfill";
import { allowAction, bypassMiddleware, mountForTest } from "./test-harness";

const start = vi.fn(() => Promise.resolve({ runId: "run_1" }));
const app = mountForTest(
  createBackfillRoutes({
    apiAuth: bypassMiddleware,
    audit: () => Promise.resolve(),
    rateLimit: bypassMiddleware,
    readStatus: () => Promise.resolve({ active: false }),
    requirePermission: allowAction,
    start,
  }),
);

describe("POST /network", () => {
  it("starts the network backfill and returns its run", async () => {
    const res = await app.request("/network", { method: "POST" });

    expect(res.status).toBe(202);
    expect(await res.json()).toEqual({ runId: "run_1" });
  });

  it("answers 409 while a backfill is already running", async () => {
    start.mockRejectedValueOnce(new BackfillAlreadyRunningError("network backfill"));

    const res = await app.request("/network", { method: "POST" });

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      error: {
        code: "BACKFILL_ALREADY_RUNNING",
        message: "A network backfill is already running.",
      },
    });
  });
});
