import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const REQUIRED_ENV = {
  DATABASE_URL: "postgresql://test:test@localhost:5432/test",
  REDIS_URL: "redis://localhost:6379",
  WP_ENCRYPTION_KEY: Buffer.alloc(32).toString("base64"),
};

describe("env", () => {
  beforeEach(() => {
    Object.assign(process.env, REQUIRED_ENV);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("defaults HERO_AUTOGEN_ENABLED to true", async () => {
    vi.resetModules();
    delete process.env.HERO_AUTOGEN_ENABLED; // required vars already set by this file's fixture
    const { env } = await import("./env");
    expect(env.HERO_AUTOGEN_ENABLED).toBe(true);
  });

  it("parses HERO_AUTOGEN_ENABLED='false' to false", async () => {
    vi.resetModules();
    vi.stubEnv("HERO_AUTOGEN_ENABLED", "false");
    const { env } = await import("./env");
    expect(env.HERO_AUTOGEN_ENABLED).toBe(false);
  });

  it.each([undefined, "true"])("makes body images opt-in: %s", async (value) => {
    vi.resetModules();
    vi.stubEnv("BODY_IMAGES_ENABLED", value);
    const { env } = await import("./env");
    expect(env.BODY_IMAGES_ENABLED).toBe(value === "true");
  });

  it("rejects a WP_ENCRYPTION_KEY that does not decode to 32 bytes", async () => {
    vi.resetModules();
    vi.stubEnv("WP_ENCRYPTION_KEY", "test-key");
    await expect(import("./env")).rejects.toThrow(/WP_ENCRYPTION_KEY/v);
  });
});
