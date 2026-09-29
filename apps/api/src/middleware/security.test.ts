import { Hono } from "hono";
import type { Context } from "hono";
import { describe, expect, it, vi } from "vitest";

import type { AuthActor } from "./actor";
import { apiSecurityHeaders, apiRateLimitKey, requestSizeLimit } from "./security";

type SecurityResponseBody = {
  error: { code: string; message: string };
};

const createMockContext = (
  options: { actor?: AuthActor; headers?: Record<string, string> } = {},
) => {
  const { actor, headers = {} } = options;
  let currentActor = actor;

  return {
    get: vi.fn((key: string) => (key === "actor" ? currentActor : undefined)),
    header: vi.fn(),
    json: vi.fn((body: SecurityResponseBody, status?: number) => ({ body, status })),
    req: {
      header: vi.fn((name: string) => headers[name]),
      method: "GET",
      path: "/test",
      url: "http://localhost/test",
    },
    set: vi.fn((key: string, value: AuthActor) => {
      if (key === "actor") {
        currentActor = value;
      }
    }),
  } as unknown as Context & { json: ReturnType<typeof vi.fn> };
};

describe("requestSizeLimit", () => {
  const next = vi.fn();

  it("should reject requests exceeding max size", async () => {
    const middleware = requestSizeLimit(1024);
    const c = createMockContext({ headers: { "content-length": "2048" } });

    await middleware(c, next);

    expect(c.json).toHaveBeenCalledWith(
      { error: { code: "PAYLOAD_TOO_LARGE", message: "Request entity too large" } },
      413,
    );
    expect(next).not.toHaveBeenCalled();
  });

  it("should pass requests within size limit", async () => {
    const middleware = requestSizeLimit(1024);
    const c = createMockContext({ headers: { "content-length": "512" } });

    await middleware(c, next);

    expect(next).toHaveBeenCalled();
  });

  it("should pass requests with no content-length header", async () => {
    const middleware = requestSizeLimit(1024);
    const c = createMockContext();

    await middleware(c, next);

    expect(next).toHaveBeenCalled();
  });

  it("should use default 10MB limit when no argument provided", async () => {
    const middleware = requestSizeLimit();
    const c = createMockContext({ headers: { "content-length": "5000000" } });

    await middleware(c, next);

    expect(next).toHaveBeenCalled();
  });

  it("should reject when exceeding default 10MB limit", async () => {
    const middleware = requestSizeLimit();
    const c = createMockContext({ headers: { "content-length": "20000000" } });

    await middleware(c, next);

    expect(c.json).toHaveBeenCalledWith(
      { error: { code: "PAYLOAD_TOO_LARGE", message: "Request entity too large" } },
      413,
    );
  });
});

describe("apiRateLimitKey", () => {
  it("keys on actor kind + id when an apikey actor is set", () => {
    const c = createMockContext({
      actor: { id: "key_1", kind: "apikey", scopes: [], siteId: null },
    });
    expect(apiRateLimitKey(c)).toBe("actor:apikey:key_1");
  });

  it("keys on actor kind + id for a user actor", () => {
    const c = createMockContext({ actor: { id: "u_1", kind: "user" } });
    expect(apiRateLimitKey(c)).toBe("actor:user:u_1");
  });

  it("keeps user and apikey ids in separate buckets even when ids collide", () => {
    const userCtx = createMockContext({ actor: { id: "shared", kind: "user" } });
    const keyCtx = createMockContext({
      actor: { id: "shared", kind: "apikey", scopes: [], siteId: null },
    });
    expect(apiRateLimitKey(userCtx)).not.toBe(apiRateLimitKey(keyCtx));
  });

  it("falls back to IP keying when no actor is present", () => {
    const c = createMockContext({ headers: { "x-forwarded-for": "203.0.113.7" } });
    expect(apiRateLimitKey(c)).toBe("ip:unknown");
  });
});

it("allows Scalar's CDN only on /docs and disables COEP there", async () => {
  const app = new Hono();
  app.use("*", apiSecurityHeaders);
  app.get("/docs", (c) => c.html("<html>Docs</html>"));
  app.get("/healthz", (c) => c.json({ status: "healthy" }));
  const docs = await app.request("/docs");
  const health = await app.request("/healthz");
  expect(docs.headers.get("Content-Security-Policy")).toContain("https://cdn.jsdelivr.net");
  expect(docs.headers.has("Cross-Origin-Embedder-Policy")).toBe(false);
  expect(health.headers.get("Content-Security-Policy")).not.toContain("https://cdn.jsdelivr.net");
  expect(health.headers.get("Cross-Origin-Embedder-Policy")).toBe("require-corp");
});
