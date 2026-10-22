import { describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  Object.assign(process.env, {
    DATABASE_URL: "postgresql://test:test@localhost:5440/easeia_test",
    REDIS_URL: "redis://localhost:6381",
    WP_ENCRYPTION_KEY: "test-encryption-key",
  });
});

import { AiBudgetExceededError, AiNotConfiguredError } from "@repo/ai";
import { JobKind, JobSkippedError } from "@repo/jobs";

import { isRetryable, skipOptionalAiWhenUnconfigured } from "./ai-unavailable";

const ctx = { attemptsMade: 0, finalAttempt: false, jobId: "j", payload: { postId: "p1" } };
const failingWith = (error: Error) => vi.fn().mockRejectedValue(error);

describe("isRetryable", () => {
  it("fails a Job without retrying when AI is unconfigured or out of budget", () => {
    expect(isRetryable(new AiNotConfiguredError())).toBe(false);
    expect(isRetryable(new AiBudgetExceededError("2026-10"))).toBe(false);
  });

  it("retries every other failure", () => {
    expect(isRetryable(new Error("openai 500"))).toBe(true);
  });
});

describe("skipOptionalAiWhenUnconfigured", () => {
  it("completes an optional-AI Job when AI is unconfigured", async () => {
    const handle = skipOptionalAiWhenUnconfigured(
      JobKind.EMBED,
      failingWith(new AiNotConfiguredError()),
    );

    await expect(handle(ctx)).rejects.toBeInstanceOf(JobSkippedError);
  });

  it("fails an optional-AI Job when the budget is exhausted", async () => {
    const handle = skipOptionalAiWhenUnconfigured(
      JobKind.GENERATE_IMAGE,
      failingWith(new AiBudgetExceededError("2026-10")),
    );

    await expect(handle(ctx)).rejects.toBeInstanceOf(AiBudgetExceededError);
  });

  it("fails a Job whose output needs AI when AI is unconfigured", async () => {
    const handle = skipOptionalAiWhenUnconfigured(
      JobKind.REWRITE_POST,
      failingWith(new AiNotConfiguredError()),
    );

    await expect(handle(ctx)).rejects.toBeInstanceOf(AiNotConfiguredError);
  });
});
