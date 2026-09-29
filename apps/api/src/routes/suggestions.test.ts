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

import { createSuggestionRoutes } from "./suggestions";
import { allowAction, bypassMiddleware, mountForTest } from "./test-harness";

const updateMock = vi.fn(() =>
  Promise.resolve({ anchorText: "new anchor", approved: null, id: "l1" }),
);
const suggestionRoutes = createSuggestionRoutes({
  apiAuth: bypassMiddleware,
  audit: () => Promise.resolve(),
  listSuggestions: () => Promise.resolve([]),
  rateLimit: bypassMiddleware,
  requirePermission: allowAction,
  updateSuggestion: updateMock,
});
const app = mountForTest(suggestionRoutes);

type AnchorRequestBody = { anchorText: number | string };

const patch = (path: string, body?: AnchorRequestBody) =>
  app.request(path, {
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
    method: "PATCH",
  });

describe("PATCH /:id/anchor: validation error envelope", () => {
  it("returns the standard error envelope on an invalid body", async () => {
    const res = await patch("/l1/anchor", { anchorText: 123 });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: {
        code: "VALIDATION_ERROR",
        details: expect.any(Array),
        message: "Validation failed",
      },
    });
  });

  it("updates the anchor on a valid body", async () => {
    const res = await patch("/l1/anchor", { anchorText: "new anchor" });
    expect(res.status).toBe(200);
    expect(updateMock).toHaveBeenCalledWith("l1", { anchorText: "new anchor" });
  });
});

it("requires an anchor instead of accepting an unimplemented regenerate request", async () => {
  const res = await app.request("/l1/anchor", {
    body: JSON.stringify({ regenerate: true }),
    headers: { "Content-Type": "application/json" },
    method: "PATCH",
  });
  expect(res.status).toBe(400);
});
