import { BackfillAlreadyRunningError } from "@repo/backfill";
import { describe, expect, it, vi } from "vitest";

import { createBackfillRoutes } from "./backfill";
import { mountForTest, openGuards } from "./test-harness";

const start = vi.fn(() => Promise.resolve({ runId: "run_1" }));

const app = mountForTest(
  createBackfillRoutes({
    ...openGuards,
    readStatus: () => Promise.resolve({ active: false }),
    start,
  }),
);

describe("POST /network", () => {
  it("starts the network backfill and returns its run", async () => {
    const res = await app.request("/network", { method: "POST" });

    expect(res.status).toBe(202);
    expect(await res.json()).toEqual({ runId: "run_1" });
  });

  it("answers 409 while a backfill is already running", async () => {
    start.mockRejectedValueOnce(new BackfillAlreadyRunningError("network backfill"));

    const res = await app.request("/network", { method: "POST" });

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      error: {
        code: "BACKFILL_ALREADY_RUNNING",
        message: "A network backfill is already running.",
      },
    });
  });
});
