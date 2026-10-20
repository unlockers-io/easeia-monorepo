import { afterEach, describe, expect, it, vi } from "vitest";

import { startMaintenance } from "./maintenance";

const setup = () => {
  const tasks = {
    dispatch: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    network: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    rewrite: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
  };
  const reportError = vi.fn<(activity: string, error: Error) => void>();
  vi.useFakeTimers();
  return { reportError, tasks };
};
afterEach(() => vi.useRealTimers());

describe("worker maintenance", () => {
  it("keeps dispatching while a backfill is pending, without overlapping that backfill", async () => {
    const { reportError, tasks } = setup();
    const gate = Promise.withResolvers<undefined>();
    tasks.network.mockReturnValueOnce(gate.promise);
    const stop = startMaintenance(tasks, reportError);
    try {
      await vi.advanceTimersByTimeAsync(2000);
      expect(tasks.network).toHaveBeenCalledOnce();
      expect(tasks.rewrite).toHaveBeenCalledTimes(3);
      expect(tasks.dispatch).toHaveBeenCalledTimes(3);
      let stopped = false;
      const closing = (async () => {
        await stop();
        stopped = true;
      })();
      await vi.advanceTimersByTimeAsync(2000);
      expect(stopped).toBe(false);
      expect(tasks.dispatch).toHaveBeenCalledTimes(3);
      gate.resolve(undefined);
      await closing;
      expect(stopped).toBe(true);
    } finally {
      gate.resolve(undefined);
      await stop();
    }
  });

  it.each(["network", "rewrite", "dispatch"] as const)(
    "retries failed %s work while the others continue",
    async (activity) => {
      const { reportError, tasks } = setup();
      const error = new Error("injected maintenance failure");
      tasks[activity].mockRejectedValueOnce(error);
      const stop = startMaintenance(tasks, reportError);
      try {
        await vi.advanceTimersByTimeAsync(1000);
        expect(tasks.network).toHaveBeenCalledTimes(2);
        expect(tasks.rewrite).toHaveBeenCalledTimes(2);
        expect(tasks.dispatch).toHaveBeenCalledTimes(2);
        expect(reportError).toHaveBeenCalledExactlyOnceWith(activity, error);
      } finally {
        await stop();
      }
    },
  );
});
