import { describe, expect, it, vi } from "vitest";

import { createBudgetedFetch } from "./budget-fetch";
import { AiBudgetExceededError } from "./errors";

const requestBody = { input: "Write a post", model: "gpt-5.6-luna" };
const makeRequest = () =>
  new Request("https://api.openai.com/v1/responses", {
    body: JSON.stringify(requestBody),
    headers: { Authorization: "Bearer test", "Content-Type": "application/json" },
    method: "POST",
  });
const usage = { input_tokens: 100, output_tokens: 200 };
const setup = () => {
  const fetch = vi.fn<typeof globalThis.fetch>(() => Promise.resolve(Response.json({ usage })));
  const store = {
    reserve: vi.fn((_month: string, _amount: number, _limit: number) => Promise.resolve(true)),
    settle: vi.fn((_month: string, _reserved: number, _cost: number) => Promise.resolve()),
  };
  const now = vi.fn(() => new Date("2026-09-14T12:00:00Z"));
  const startMonth = vi.fn<() => string | undefined>(() => undefined);
  const guarded = createBudgetedFetch({ fetch, limit: () => 18_000_000, now, startMonth, store });
  return { fetch, guarded, now, startMonth, store };
};

describe("budgeted OpenAI transport", () => {
  it("keeps September running without ledger access and enforces the allowance from October 1 UTC", async () => {
    const { fetch, guarded, now, startMonth, store } = setup();
    startMonth.mockReturnValue("2026-10");
    now.mockReturnValue(new Date("2026-09-30T23:59:59Z"));
    store.reserve.mockResolvedValue(false);
    fetch.mockImplementationOnce(async (input) => {
      const request = new Request(input);
      expect(await request.json()).toEqual(requestBody);
      return Response.json({ usage });
    });
    await guarded(makeRequest());
    expect(store.reserve).not.toHaveBeenCalled();
    expect(store.settle).not.toHaveBeenCalled();

    now.mockReturnValue(new Date("2026-10-01T00:00:00Z"));
    await expect(guarded(makeRequest())).rejects.toBeInstanceOf(AiBudgetExceededError);
    expect(store.reserve).toHaveBeenCalledWith("2026-10", expect.any(Number), 18_000_000);
    expect(fetch).toHaveBeenCalledOnce();

    now.mockReturnValue(new Date("2026-11-01T00:00:00Z"));
    store.reserve.mockResolvedValue(true);
    await guarded(makeRequest());
    expect(store.settle).toHaveBeenCalledWith("2026-11", expect.any(Number), 400);
  });

  it("reserves before a paid call, preserves headers/body, and refunds unused allowance", async () => {
    const { fetch, guarded, store } = setup();
    fetch.mockImplementationOnce(async (input) => {
      expect(store.reserve).toHaveBeenCalledOnce();
      const request = new Request(input);
      expect(request.headers.get("Authorization")).toBe("Bearer test");
      expect(await request.json()).toMatchObject({ ...requestBody, max_output_tokens: 16_384 });
      return Response.json({ usage });
    });
    const response = await guarded(makeRequest());
    expect(await response.json()).toEqual({ usage });
    expect(store.settle).toHaveBeenCalledWith("2026-09", expect.any(Number), 400);
  });

  it("does not call OpenAI when the allowance is exhausted", async () => {
    const { fetch, guarded, store } = setup();
    store.reserve.mockResolvedValue(false);
    await expect(guarded(makeRequest())).rejects.toBeInstanceOf(AiBudgetExceededError);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("fails closed when the shared ledger is unavailable", async () => {
    const { fetch, guarded, store } = setup();
    store.reserve.mockRejectedValue(new Error("database unavailable"));
    await expect(guarded(makeRequest())).rejects.toThrow("database unavailable");
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([Response.json({}, { status: 429 }), Response.json({}), new Response("invalid json")])(
    "retains the reservation on HTTP errors or missing usage",
    async (response) => {
      const { fetch, guarded, store } = setup();
      fetch.mockResolvedValue(response);
      await guarded(makeRequest());
      expect(store.settle).not.toHaveBeenCalled();
    },
  );

  it("retains network-failure reservations and reserves again for retries", async () => {
    const { fetch, guarded, store } = setup();
    fetch.mockRejectedValueOnce(new Error("timeout"));
    await expect(guarded(makeRequest())).rejects.toThrow("timeout");
    expect(store.settle).not.toHaveBeenCalled();
    await guarded(makeRequest());
    expect(store.reserve).toHaveBeenCalledTimes(2);
    expect(store.settle).toHaveBeenCalledOnce();
  });

  it("returns a paid response if settlement fails, without retrying it", async () => {
    const { fetch, guarded, store } = setup();
    store.settle.mockRejectedValue(new Error("database unavailable"));
    const response = await guarded(makeRequest());
    expect(response.ok).toBe(true);
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("settles a request crossing midnight in its reserved month and opens the new month", async () => {
    const { fetch, guarded, now, store } = setup();
    now.mockReturnValue(new Date("2026-09-30T23:59:59Z"));
    fetch.mockImplementationOnce(() => {
      now.mockReturnValue(new Date("2026-10-01T00:00:01Z"));
      return Promise.resolve(Response.json({ usage }));
    });
    await guarded(makeRequest());
    await guarded(makeRequest());
    expect(store.settle.mock.calls.map(([month]) => month)).toEqual(["2026-09", "2026-10"]);
    expect(store.reserve.mock.calls.map(([month]) => month)).toEqual(["2026-09", "2026-10"]);
  });
});
