import { authEnvSchema, parseEnv } from "@repo/auth/env";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createGetAuth } from "./auth";

const createAuthMock = vi.fn(() => ({ options: {} }));

const buildAuth = () => {
  const getAuth = createGetAuth(createAuthMock, () => parseEnv(authEnvSchema));
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
    vi.stubEnv("MAIL_TRANSPORT", "outbox");
    vi.stubEnv("RESEND_API_KEY", undefined);

    buildAuth();

    expect(createAuthMock).toHaveBeenCalledWith(
      expect.objectContaining({ mailer: expect.objectContaining({ from: "noreply@easeia.com" }) }),
    );
  });

  it("should ignore RESEND_FROM_EMAIL and never fall back to the Resend sandbox sender", () => {
    vi.stubEnv("BETTER_AUTH_SECRET", "a".repeat(32));
    vi.stubEnv("FROM_EMAIL", "noreply@easeia.com");
    vi.stubEnv("RESEND_FROM_EMAIL", "wrong@example.com");
    vi.stubEnv("RESEND_API_KEY", "re_test");

    buildAuth();

    expect(createAuthMock).toHaveBeenCalledWith(
      expect.objectContaining({ mailer: expect.objectContaining({ from: "noreply@easeia.com" }) }),
    );
  });

  it("should refuse to build auth without FROM_EMAIL", () => {
    vi.stubEnv("BETTER_AUTH_SECRET", "a".repeat(32));
    vi.stubEnv("FROM_EMAIL", undefined);
    vi.stubEnv("RESEND_API_KEY", "re_test");

    expect(buildAuth).toThrow(/FROM_EMAIL/v);
    expect(createAuthMock).not.toHaveBeenCalled();
  });

  it.each([undefined, ""])("should refuse to build auth with the RESEND_API_KEY %j", (key) => {
    vi.stubEnv("BETTER_AUTH_SECRET", "a".repeat(32));
    vi.stubEnv("FROM_EMAIL", "noreply@easeia.com");
    vi.stubEnv("MAIL_TRANSPORT", undefined);
    vi.stubEnv("RESEND_API_KEY", key);

    expect(buildAuth).toThrow("RESEND_API_KEY is required unless MAIL_TRANSPORT=outbox");
    expect(createAuthMock).not.toHaveBeenCalled();
  });
});
