import { describe, expect, it, vi } from "vitest";

import { settleFanout, type FanoutTask } from "./settle-fanout";

const makeLog = () => ({ emit: vi.fn(), error: vi.fn() });

const ok = (id: string): FanoutTask => ({
  id,
  run: () => Promise.resolve(),
});

const fails = (id: string, reason: Error): FanoutTask => ({
  id,
  run: () => Promise.reject(reason),
});

describe("settleFanout", () => {
  it("does nothing when every enqueue fulfilled", async () => {
    const log = makeLog();

    await settleFanout([ok("a"), ok("b")], "msg", log);

    expect(log.error).not.toHaveBeenCalled();
    expect(log.emit).not.toHaveBeenCalled();
  });

  it("does nothing on an empty fan-out", async () => {
    const log = makeLog();

    await settleFanout([], "msg", log);

    expect(log.error).not.toHaveBeenCalled();
    expect(log.emit).not.toHaveBeenCalled();
  });

  it("logs each rejection with its own id, emits, then throws on partial failure", async () => {
    const log = makeLog();
    const boom = new Error("redis down");

    const nope = new Error("nope");
    const tasks = [ok("a"), fails("b", boom), fails("c", nope)];

    await expect(settleFanout(tasks, "fanout failed", log)).rejects.toThrow(
      "fanout failed: 2/3 enqueues failed",
    );

    expect(log.error).toHaveBeenCalledTimes(2);
    expect(log.error).toHaveBeenNthCalledWith(1, boom, { enqueueFailedFor: "b" });
    expect(log.error).toHaveBeenNthCalledWith(2, expect.any(Error), { enqueueFailedFor: "c" });
    expect(log.emit).toHaveBeenCalledTimes(1);
  });

  it("throws on total failure", async () => {
    const log = makeLog();

    const tasks = [fails("a", new Error("x"))];

    await expect(settleFanout(tasks, "msg", log)).rejects.toThrow("msg: 1/1 enqueues failed");
    expect(log.emit).toHaveBeenCalledTimes(1);
  });

  it("keeps the id attached through a 1-item-to-2-tasks expansion", async () => {
    const log = makeLog();
    const items = [{ id: "p1" }, { id: "p2" }];
    const tasks = items.flatMap((p) => [
      ok(p.id),
      { id: p.id, run: () => Promise.reject(new Error(`second task for ${p.id}`)) },
    ]);

    await expect(settleFanout(tasks, "expanded", log)).rejects.toThrow(
      "expanded: 2/4 enqueues failed",
    );

    expect(log.error).toHaveBeenNthCalledWith(1, expect.anything(), { enqueueFailedFor: "p1" });
    expect(log.error).toHaveBeenNthCalledWith(2, expect.anything(), { enqueueFailedFor: "p2" });
  });

  it("runs the tasks concurrently rather than in sequence", async () => {
    const log = makeLog();
    let started = 0;
    const slow = (id: string): FanoutTask => ({
      id,
      run: async () => {
        started += 1;
        await Promise.resolve();
      },
    });

    const pending = settleFanout([slow("a"), slow("b"), slow("c")], "msg", log);
    expect(started).toBe(3);
    await pending;
  });
});
