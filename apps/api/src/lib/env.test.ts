import { describe, expect, it, vi } from "vitest";

vi.stubEnv("BETTER_AUTH_SECRET", "a".repeat(32));
vi.stubEnv("DATABASE_URL", "postgresql://user:pass@localhost:5432/db");
vi.stubEnv("FROM_EMAIL", "noreply@easeia.com");
vi.stubEnv("REDIS_URL", "redis://localhost:6379");
vi.stubEnv("WP_ENCRYPTION_KEY", "a".repeat(44));

const { envSchema } = await import("./env");

const validEnv = {
  BETTER_AUTH_SECRET: "a".repeat(32),
  DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
  FROM_EMAIL: "noreply@easeia.com",
  REDIS_URL: "redis://localhost:6379",
  WP_ENCRYPTION_KEY: "a".repeat(44),
};

describe("envSchema", () => {
  it("should accept valid environment variables", () => {
    const result = envSchema.safeParse(validEnv);
    expect(result.success).toBe(true);
  });

  it("should apply default values", () => {
    const result = envSchema.safeParse(validEnv);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.PORT).toBe("4000");
      expect(result.data.HOST).toBe("0.0.0.0");
      expect(result.data.NODE_ENV).toBe("development");
      expect(result.data.CORS_ORIGINS).toBe(
        "https://easeia.web.localhost,https://easeia.landing.localhost",
      );
    }
  });

  it("should require FROM_EMAIL when Resend is enabled", () => {
    const { FROM_EMAIL: _omitted, ...withoutFromEmail } = validEnv;
    const result = envSchema.safeParse({ ...withoutFromEmail, RESEND_API_KEY: "re_test" });
    expect(result.success).toBe(false);
  });

  it("should treat an empty FROM_EMAIL as unset without Resend", () => {
    const result = envSchema.safeParse({ ...validEnv, FROM_EMAIL: "" });
    expect(result.success).toBe(true);
  });

  it("should reject a FROM_EMAIL that is not a deliverable address", () => {
    for (const malformed of ["noreply@easeia", "easeia.com", "noreply @easeia.com"]) {
      const result = envSchema.safeParse({ ...validEnv, FROM_EMAIL: malformed });
      expect(result.success).toBe(false);
    }
  });

  it("should accept the RFC 5322 display-name sender form", () => {
    const result = envSchema.safeParse({
      ...validEnv,
      FROM_EMAIL: "Easeia <noreply@easeia.com>",
    });
    expect(result.success).toBe(true);
  });

  it("should allow optional AUTH_ALLOWED_HOSTS", () => {
    const result = envSchema.safeParse({
      ...validEnv,
      AUTH_ALLOWED_HOSTS: "app.easeia.com,*.easeia.com,*.vercel.app",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.AUTH_ALLOWED_HOSTS).toBe("app.easeia.com,*.easeia.com,*.vercel.app");
    }
  });

  it("should reject missing BETTER_AUTH_SECRET", () => {
    const result = envSchema.safeParse({ ...validEnv, BETTER_AUTH_SECRET: undefined });
    expect(result.success).toBe(false);
  });

  it("should reject BETTER_AUTH_SECRET shorter than 32 characters", () => {
    const result = envSchema.safeParse({ ...validEnv, BETTER_AUTH_SECRET: "short" });
    expect(result.success).toBe(false);
  });

  it("should reject missing DATABASE_URL", () => {
    const result = envSchema.safeParse({ ...validEnv, DATABASE_URL: undefined });
    expect(result.success).toBe(false);
  });

  it("should reject empty DATABASE_URL", () => {
    const result = envSchema.safeParse({ ...validEnv, DATABASE_URL: "" });
    expect(result.success).toBe(false);
  });

  it("should reject missing REDIS_URL", () => {
    const result = envSchema.safeParse({ ...validEnv, REDIS_URL: undefined });
    expect(result.success).toBe(false);
  });

  it("should reject missing WP_ENCRYPTION_KEY", () => {
    const result = envSchema.safeParse({ ...validEnv, WP_ENCRYPTION_KEY: undefined });
    expect(result.success).toBe(false);
  });

  it("should reject invalid NODE_ENV values", () => {
    const result = envSchema.safeParse({ ...validEnv, NODE_ENV: "staging" });
    expect(result.success).toBe(false);
  });

  it("should accept all valid NODE_ENV values", () => {
    for (const nodeEnv of ["development", "production", "test"]) {
      const result = envSchema.safeParse({ ...validEnv, NODE_ENV: nodeEnv });
      expect(result.success).toBe(true);
    }
  });

  it("should allow optional RESEND_API_KEY", () => {
    const result = envSchema.safeParse(validEnv);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.RESEND_API_KEY).toBeUndefined();
    }
  });

  it("should allow optional TRUSTED_ORIGINS", () => {
    const result = envSchema.safeParse({ ...validEnv, TRUSTED_ORIGINS: "https://example.com" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.TRUSTED_ORIGINS).toBe("https://example.com");
    }
  });
});
