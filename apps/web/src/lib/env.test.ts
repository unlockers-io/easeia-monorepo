import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const VALID_ENV = {
  BETTER_AUTH_SECRET: "a".repeat(32),
  FROM_EMAIL: "noreply@easeia.com",
  REDIS_URL: "redis://test",
} as const;

const loadGetEnv = async (overrides: Record<string, string | undefined> = {}) => {
  for (const [name, value] of Object.entries({ ...VALID_ENV, ...overrides })) {
    vi.stubEnv(name, value);
  }

  vi.resetModules();
  const { getEnv } = await import("./env");
  return getEnv;
};

describe("getEnv", () => {
  beforeEach(() => {
    vi.stubEnv("RESEND_API_KEY", undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("should return the parsed environment when every required variable is set", async () => {
    const getEnv = await loadGetEnv();
    expect(getEnv().FROM_EMAIL).toBe("noreply@easeia.com");
  });

  it("should require FROM_EMAIL only when Resend is enabled", async () => {
    const getEnv = await loadGetEnv({ FROM_EMAIL: undefined, RESEND_API_KEY: "re_test" });
    expect(() => getEnv()).toThrow(/FROM_EMAIL/v);
  });

  it.each(["noreply@easeia", "easeia.com", "noreply @easeia.com"])(
    "should reject the undeliverable FROM_EMAIL %j",
    async (malformed) => {
      const getEnv = await loadGetEnv({ FROM_EMAIL: malformed });
      expect(() => getEnv()).toThrow(/FROM_EMAIL/v);
    },
  );

  it("should accept the RFC 5322 display-name sender form", async () => {
    const getEnv = await loadGetEnv({ FROM_EMAIL: "Easeia <noreply@easeia.com>" });
    expect(getEnv().FROM_EMAIL).toBe("Easeia <noreply@easeia.com>");
  });

  it("should reject a BETTER_AUTH_SECRET shorter than 32 characters", async () => {
    const getEnv = await loadGetEnv({ BETTER_AUTH_SECRET: "short" });
    expect(() => getEnv()).toThrow(/BETTER_AUTH_SECRET/v);
  });

  it("should leave RESEND_API_KEY optional", async () => {
    const getEnv = await loadGetEnv();
    expect(getEnv().RESEND_API_KEY).toBeUndefined();
  });

  it("should not read the undocumented RESEND_FROM_EMAIL", async () => {
    vi.stubEnv("RESEND_FROM_EMAIL", "sender@example.com");
    const getEnv = await loadGetEnv({ FROM_EMAIL: undefined, RESEND_API_KEY: "re_test" });
    expect(() => getEnv()).toThrow(/FROM_EMAIL/v);
  });
});
