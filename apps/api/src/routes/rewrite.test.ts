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

import { createRewriteRoutes } from "./rewrite";
import { allowAction, bypassMiddleware, mountForTest } from "./test-harness";

const enqueueMock = vi.fn(() => Promise.resolve({ id: "job_1", queueJobId: undefined }));
const rewriteRoutes = createRewriteRoutes({
  apiAuth: bypassMiddleware,
  audit: () => Promise.resolve(),
  enqueueJob: enqueueMock,
  getRedisUrl: () => "redis://test",
  rateLimit: bypassMiddleware,
  readStatus: () => Promise.resolve({ active: false }),
  requirePermission: allowAction,
});
const app = mountForTest(rewriteRoutes);

type RewriteRequestBody = { force: boolean | number | string };

const post = (path: string, body?: RewriteRequestBody) =>
  app.request(path, {
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    method: "POST",
  });

describe("rewrite write routes: body validation", () => {
  it("POST /network accepts an empty body (force defaults to false)", async () => {
    const res = await post("/network");
    expect(res.status).toBe(202);
    expect(enqueueMock).toHaveBeenCalledWith(
      expect.objectContaining({ payload: expect.objectContaining({ force: false }) }),
    );
  });

  it("POST /network accepts force: true", async () => {
    const res = await post("/network", { force: true });
    expect(res.status).toBe(202);
    expect(enqueueMock).toHaveBeenCalledWith(
      expect.objectContaining({ payload: expect.objectContaining({ force: true }) }),
    );
  });

  it("POST /network rejects a malformed force body with the standard envelope", async () => {
    const res = await post("/network", { force: "yes" });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: {
        code: "VALIDATION_ERROR",
        details: expect.any(Array),
        message: "Validation failed",
      },
    });
  });

  it("POST /post/:id accepts an empty body", async () => {
    const res = await post("/post/p1");
    expect(res.status).toBe(202);
  });

  it("POST /post/:id rejects a malformed force body", async () => {
    const res = await post("/post/p1", { force: 7 });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: {
        code: "VALIDATION_ERROR",
        details: expect.any(Array),
        message: "Validation failed",
      },
    });
  });
});
