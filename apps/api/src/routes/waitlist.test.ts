import { describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  Object.assign(process.env, {
    BETTER_AUTH_SECRET: "test-secret-that-is-at-least-32-characters",
    DATABASE_URL: "postgresql://test:test@localhost:5440/easeia_test",
    REDIS_URL: "redis://localhost:6381",
    WP_ENCRYPTION_KEY: "test-encryption-key",
  });
});

import { createWaitlistRateLimit } from "@/middleware/security";

import { bypassMiddleware, mountForTest } from "./test-harness";
import { createWaitlistRoutes } from "./waitlist";

const makeApp = (limited = false) => {
  const save = vi.fn(() => Promise.resolve());
  const app = mountForTest(
    createWaitlistRoutes({
      rateLimit: limited ? createWaitlistRateLimit() : bypassMiddleware,
      save,
    }),
  );
  const post = (
    body: { email: string; source?: string; website?: string },
    headers: Record<string, string> = {},
  ) =>
    app.request("/", {
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json", ...headers },
      method: "POST",
    });
  return { post, save };
};

describe("public waitlist", () => {
  it("normalizes addresses and accepts repeats without disclosing membership", async () => {
    const { post, save } = makeApp();
    const first = await post({ email: " Demo@Example.com ", source: "landing" });
    const repeat = await post({ email: "demo@example.com", source: "landing" });
    expect(first.status).toBe(201);
    expect(repeat.status).toBe(201);
    expect(await repeat.json()).toEqual(await first.json());
    expect(save).toHaveBeenNthCalledWith(1, { email: "demo@example.com", source: "landing" });
  });
  it("rejects invalid email and long sources without writing", async () => {
    const { post, save } = makeApp();
    const response = await post({ email: "invalid" });
    expect(response.status).toBe(400);
    const longSource = await post({ email: "demo@example.com", source: "x".repeat(101) });
    expect(longSource.status).toBe(400);
    expect(save).not.toHaveBeenCalled();
  });
  it("accepts the honeypot without writing", async () => {
    const { post, save } = makeApp();
    const response = await post({ email: "bot@example.com", website: "spam" });
    expect(response.status).toBe(201);
    expect(save).not.toHaveBeenCalled();
  });
  it("rejects oversized bodies before validation", async () => {
    const { post, save } = makeApp();
    const response = await post({ email: "x".repeat(5000) });
    expect(response.status).toBe(413);
    expect(save).not.toHaveBeenCalled();
  });
  it("limits the sixth attempt even when untrusted forwarding headers change", async () => {
    const { post, save } = makeApp(true);
    for (let i = 0; i < 5; i += 1) {
      const attempt = await post(
        { email: "demo@example.com" },
        { "x-forwarded-for": `203.0.113.${i}` },
      );
      expect(attempt.status).toBe(201);
    }
    const response = await post(
      { email: "demo@example.com" },
      { "x-forwarded-for": "203.0.113.99" },
    );
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBeTruthy();
    expect(save).toHaveBeenCalledTimes(5);
  });
});
