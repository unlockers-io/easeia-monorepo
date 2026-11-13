import { JobSkippedError } from "@repo/jobs";
import { describe, expect, it, vi } from "vitest";

import { makeWithJobLog } from "./job-log";

const ctx = { jobId: "job_1", payload: { postId: "post_1" } };

const setup = () => {
  const log = { emit: vi.fn(), error: vi.fn(), info: vi.fn(), set: vi.fn(), warn: vi.fn() };
  const createLog = vi.fn(() => log);

  return { createLog, log, withJobLog: makeWithJobLog(createLog) };
};

describe("withJobLog", () => {
  it("names the logger after the kind and emits once when the handler returns", async () => {
    const { createLog, log, withJobLog } = setup();

    await withJobLog("SUGGEST_LINKS", async (job) => {
      job.log.set({ postId: job.payload.postId });
      await Promise.resolve();
    })(ctx);

    expect(createLog).toHaveBeenCalledExactlyOnceWith({
      jobId: "job_1",
      queue: "suggest-links",
    });
    expect(log.set).toHaveBeenCalledExactlyOnceWith({ postId: "post_1" });
    expect(log.error).not.toHaveBeenCalled();
    expect(log.emit).toHaveBeenCalledTimes(1);
  });

  it("records the error of a handler that throws, emits once and rethrows", async () => {
    const { log, withJobLog } = setup();
    const failure = new Error("openai 500");

    await expect(withJobLog("EMBED", () => Promise.reject(failure))(ctx)).rejects.toBe(failure);

    expect(log.error).toHaveBeenCalledExactlyOnceWith(failure);
    expect(log.emit).toHaveBeenCalledTimes(1);
  });

  it("records a skipped job as a warning, not an error", async () => {
    const { log, withJobLog } = setup();
    const skipped = new JobSkippedError("AI is not configured");

    await expect(withJobLog("EMBED", () => Promise.reject(skipped))(ctx)).rejects.toBe(skipped);

    expect(log.warn).toHaveBeenCalledExactlyOnceWith("AI is not configured");
    expect(log.error).not.toHaveBeenCalled();
    expect(log.emit).toHaveBeenCalledTimes(1);
  });
});
