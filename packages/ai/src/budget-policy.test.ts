import { afterEach, describe, expect, it, vi } from "vitest";

import { monthlyBudgetMicroUsd, monthlyBudgetStartMonth, planAiRequest } from "./budget-policy";

const planText = (extra: Record<string, unknown> = {}) =>
  planAiRequest(
    new URL("https://api.openai.com/v1/responses"),
    JSON.stringify({
      input: "Write a post",
      model: "gpt-5.6-luna",
      ...extra,
    }),
  );

afterEach(() => vi.unstubAllEnvs());

describe("monthly allowance", () => {
  it("enforces immediately unless a valid starting month is configured", () => {
    vi.stubEnv("AI_BUDGET_START_MONTH", "");
    expect(monthlyBudgetStartMonth()).toBeUndefined();
    vi.stubEnv("AI_BUDGET_START_MONTH", " 2026-10 ");
    expect(monthlyBudgetStartMonth()).toBe("2026-10");
  });

  it.each(["2026-00", "2026-13", "2026-1", "2026-10-01", "tomorrow"])(
    "rejects an invalid starting month: %s",
    (month) => {
      vi.stubEnv("AI_BUDGET_START_MONTH", month);
      expect(monthlyBudgetStartMonth).toThrow("YYYY-MM");
    },
  );

  it("defaults to $18 and can be disabled with zero", () => {
    vi.stubEnv("AI_MONTHLY_BUDGET_USD", "");
    expect(monthlyBudgetMicroUsd()).toBe(18_000_000);
    vi.stubEnv("AI_MONTHLY_BUDGET_USD", "0");
    expect(monthlyBudgetMicroUsd()).toBe(0);
  });

  it.each(["-1", "NaN", "Infinity", "9007199254740991"])("rejects %s", (value) => {
    vi.stubEnv("AI_MONTHLY_BUDGET_USD", value);
    expect(monthlyBudgetMicroUsd).toThrow("nonnegative dollar amount");
  });
});

describe("priced requests", () => {
  it("caps output and forces standard pricing even if priority is requested", () => {
    expect(
      JSON.parse(planText({ max_output_tokens: 100_000, service_tier: "priority" }).body),
    ).toMatchObject({ max_output_tokens: 16_384, service_tier: "default" });
    expect(JSON.parse(planText({ max_output_tokens: 100 }).body).max_output_tokens).toBe(100);
  });

  it.each([
    { model: "unpriced-model" },
    { stream: true },
    { previous_response_id: "resp_old" },
    { conversation: "conv_old" },
    { prompt: { id: "pmpt_old" } },
    { input: [{ id: "msg_old", type: "item_reference" }] },
    {
      input: [
        {
          content: [{ image_url: "https://example.com/a.png", type: "input_image" }],
          role: "user",
        },
      ],
    },
  ])("blocks unpriced text options before reserving: %j", (extra) => {
    expect(() => planText(extra)).toThrow(
      "The AI budget supports stateless, non-streaming gpt-5.6-luna text requests.",
    );
  });

  it("blocks built-in tools before reserving", () => {
    expect(() => planText({ tools: [{ type: "web_search" }] })).toThrow(
      "Built-in OpenAI tools are not covered by the AI budget.",
    );
  });

  it("charges text at conservative long-context rates, including reasoning output", () => {
    const plan = planText();
    expect(plan.costOf({ usage: { input_tokens: 1000, output_tokens: 2000 } })).toBe(4000);
    expect(plan.reservedMicroUsd).toBeGreaterThan(4000);
  });

  it.each([
    { outputTokens: 158, quality: "low", totalMicroUsd: 5240 },
    { outputTokens: 1372, quality: "medium", totalMicroUsd: 41_660 },
  ])(
    "prices $quality images including prompt tokens",
    ({ outputTokens, quality, totalMicroUsd }) => {
      const plan = planAiRequest(
        new URL("https://api.openai.com/v1/images/generations"),
        JSON.stringify({
          model: "gpt-image-2",
          n: 1,
          prompt: "A desk",
          quality,
          size: "1536x1024",
        }),
      );
      expect(plan.costOf({ usage: { input_tokens: 100, output_tokens: outputTokens } })).toBe(
        totalMicroUsd,
      );
      expect(plan.reservedMicroUsd).toBeGreaterThan(totalMicroUsd);
    },
  );

  it("prices embeddings and rejects token arrays without a token bound", () => {
    const url = new URL("https://api.openai.com/v1/embeddings");
    const plan = planAiRequest(
      url,
      JSON.stringify({ input: ["a", "b"], model: "text-embedding-3-small" }),
    );
    expect(plan.costOf({ usage: { prompt_tokens: 1000 } })).toBe(20);
    expect(() =>
      planAiRequest(url, JSON.stringify({ input: [1, 2], model: "text-embedding-3-small" })),
    ).toThrow("invalid_union");
  });

  it.each([
    {},
    { usage: {} },
    { usage: { input_tokens: -1, output_tokens: 2 } },
    { usage: { input_tokens: Number.MAX_SAFE_INTEGER, output_tokens: Number.MAX_SAFE_INTEGER } },
  ])("retains the reservation when usage is unusable: %j", (response) => {
    expect(planText().costOf(response)).toBeUndefined();
  });

  it.each([
    {
      message: "The AI budget only covers requests to api.openai.com.",
      url: "https://example.com/v1/responses",
    },
    {
      message: "OpenAI endpoint /v1/chat/completions is not covered by the AI budget.",
      url: "https://api.openai.com/v1/chat/completions",
    },
  ])("rejects an unpriced URL: $url", ({ message, url }) => {
    expect(() => planAiRequest(new URL(url), JSON.stringify({ model: "gpt-5.6-luna" }))).toThrow(
      message,
    );
  });
});
