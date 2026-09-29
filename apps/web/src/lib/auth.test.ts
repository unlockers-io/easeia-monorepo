import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createGetAuth } from "./auth";
import { parseEnv } from "./env";

const createAuthMock = vi.fn(() => ({ options: {} }));

const buildAuth = () => {
  const getAuth = createGetAuth(createAuthMock, () => parseEnv(process.env));
  void getAuth().options;
};

describe("web auth configuration", () => {
  beforeEach(() => {
    createAuthMock.mockClear();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("should pass FROM_EMAIL through as the sender", () => {
    vi.stubEnv("BETTER_AUTH_SECRET", "a".repeat(32));
    vi.stubEnv("FROM_EMAIL", "noreply@easeia.com");
    vi.stubEnv("REDIS_URL", "redis://test");
    vi.stubEnv("RESEND_API_KEY", undefined);

    buildAuth();

    expect(createAuthMock).toHaveBeenCalledWith(
      expect.objectContaining({ fromEmail: "noreply@easeia.com" }),
    );
  });

  it("should ignore RESEND_FROM_EMAIL and never fall back to the Resend sandbox sender", () => {
    vi.stubEnv("BETTER_AUTH_SECRET", "a".repeat(32));
    vi.stubEnv("FROM_EMAIL", "noreply@easeia.com");
    vi.stubEnv("REDIS_URL", "redis://test");
    vi.stubEnv("RESEND_FROM_EMAIL", "wrong@example.com");
    vi.stubEnv("RESEND_API_KEY", undefined);

    buildAuth();

    expect(createAuthMock).toHaveBeenCalledWith(
      expect.objectContaining({ fromEmail: "noreply@easeia.com" }),
    );
  });

  it("should refuse to build mail-enabled auth without FROM_EMAIL", () => {
    vi.stubEnv("BETTER_AUTH_SECRET", "a".repeat(32));
    vi.stubEnv("FROM_EMAIL", undefined);
    vi.stubEnv("REDIS_URL", "redis://test");
    vi.stubEnv("RESEND_API_KEY", "re_test");

    expect(buildAuth).toThrow(/FROM_EMAIL/v);
    expect(createAuthMock).not.toHaveBeenCalled();
  });
});
