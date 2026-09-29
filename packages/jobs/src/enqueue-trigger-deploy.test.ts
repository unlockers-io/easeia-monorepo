import { beforeEach, describe, expect, it, vi } from "vitest";

import { createEnqueueTriggerDeploy } from "./enqueue-trigger-deploy";

const findInFlight = vi.fn();
const enqueueDeploy = vi.fn((input: { siteId: string }) =>
  Promise.resolve({ id: `mock-${input.siteId}` }),
);
const enqueueTriggerDeploy = createEnqueueTriggerDeploy({ enqueueDeploy, findInFlight });

describe("enqueueTriggerDeploy", () => {
  beforeEach(() => {
    findInFlight.mockReset();
    enqueueDeploy.mockClear();
  });

  it("enqueues a new TRIGGER_DEPLOY when none is in flight", async () => {
    findInFlight.mockResolvedValue(null);
    const result = await enqueueTriggerDeploy({
      redisUrl: "redis://test",
      siteId: "site_a",
    });
    expect(result.skipped).toBe(false);
    expect(result.jobId).toMatch(/^mock-/v);
  });

  it("skips when a QUEUED TRIGGER_DEPLOY for the same site exists", async () => {
    findInFlight.mockResolvedValue({ id: "existing-job" });
    const result = await enqueueTriggerDeploy({
      redisUrl: "redis://test",
      siteId: "site_a",
    });
    expect(result.skipped).toBe(true);
  });

  it("does not skip across sites", async () => {
    findInFlight.mockResolvedValue(null);
    const result = await enqueueTriggerDeploy({
      redisUrl: "redis://test",
      siteId: "site_b",
    });
    expect(result.skipped).toBe(false);
  });
});
