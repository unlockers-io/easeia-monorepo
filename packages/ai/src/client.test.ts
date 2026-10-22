import { NoObjectGeneratedError } from "ai";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { createBudgetedFetch } from "./budget-fetch";
import { createAi } from "./client";
import { AiBudgetExceededError, AiNotConfiguredError } from "./errors";
import { MODELS } from "./models";
import { createFakeOpenAi } from "./testing";

const topicSchema = z.object({ focusKeyword: z.string().min(2) });

afterEach(() => vi.unstubAllEnvs());

describe("structured generation", () => {
  it("returns the typed value the model produced", async () => {
    const fake = createFakeOpenAi();
    fake.queueOutputs({ focusKeyword: "wedding venues" });
    await expect(
      fake.ai.generateStructured({ prompt: "Pick a topic", schema: topicSchema }),
    ).resolves.toEqual({ focusKeyword: "wedding venues" });
    expect(fake.requests).toHaveLength(1);
    expect(fake.requests[0]?.body).toMatchObject({ model: MODELS.text.name });
  });

  it("asks again once when the output fails the schema", async () => {
    const fake = createFakeOpenAi();
    fake.queueOutputs({ focusKeyword: "x" }, { focusKeyword: "wedding venues" });
    await expect(
      fake.ai.generateStructured({ prompt: "Pick a topic", schema: topicSchema }),
    ).resolves.toEqual({ focusKeyword: "wedding venues" });
    expect(fake.requests).toHaveLength(2);
  });

  it("gives up after the second schema failure", async () => {
    const fake = createFakeOpenAi();
    fake.queueOutputs({ focusKeyword: "x" }, { other: true }, { focusKeyword: "unused" });
    const failure = fake.ai.generateStructured({ prompt: "Pick a topic", schema: topicSchema });
    await expect(failure).rejects.toSatisfy(NoObjectGeneratedError.isInstance);
    expect(fake.requests).toHaveLength(2);
  });
});

describe("image generation", () => {
  it("sends a priced image request through the budget seam and returns the bytes", async () => {
    vi.stubEnv("OPENAI_IMAGE_QUALITY", "low");
    const fake = createFakeOpenAi();
    const bytes = await fake.ai.generateImage("A desk by a window");
    expect(bytes.subarray(1, 4)).toEqual(new TextEncoder().encode("PNG"));
    expect(fake.requests).toEqual([
      {
        body: expect.objectContaining({
          model: MODELS.image.name,
          n: 1,
          prompt: "A desk by a window",
          quality: "low",
          size: MODELS.image.size,
        }),
        path: "/v1/images/generations",
      },
    ]);
    expect(fake.spentMicroUsd()).toBeGreaterThan(0);
  });

  it("defaults to medium quality", async () => {
    vi.stubEnv("OPENAI_IMAGE_QUALITY", "");
    const fake = createFakeOpenAi();
    await fake.ai.generateImage("A desk");
    expect(fake.requests[0]?.body).toMatchObject({ quality: "medium" });
  });
});

describe("model table", () => {
  it("prices every model the interface can call", async () => {
    const fake = createFakeOpenAi();
    fake.queueOutputs({ focusKeyword: "wedding venues" });
    const spent = [fake.spentMicroUsd()];
    await fake.ai.generateStructured({ prompt: "Pick a topic", schema: topicSchema });
    spent.push(fake.spentMicroUsd());
    await fake.ai.generateImage("A desk");
    spent.push(fake.spentMicroUsd());
    const vector = await fake.ai.embedText("A desk");
    spent.push(fake.spentMicroUsd());

    expect(fake.requests.map((r) => r.body.model)).toEqual([
      MODELS.text.name,
      MODELS.image.name,
      MODELS.embedding.name,
    ]);
    expect(vector).toHaveLength(MODELS.embedding.dimensions);
    expect(spent.every((amount, i) => i === 0 || amount > (spent[i - 1] ?? 0))).toBe(true);
  });
});

describe("unavailable AI", () => {
  it("raises the budget error before any request reaches OpenAI", async () => {
    const fake = createFakeOpenAi({ allowanceMicroUsd: 0 });
    fake.queueOutputs({ focusKeyword: "wedding venues" });
    await expect(
      fake.ai.generateStructured({ prompt: "Pick a topic", schema: topicSchema }),
    ).rejects.toBeInstanceOf(AiBudgetExceededError);
    await expect(fake.ai.generateImage("A desk")).rejects.toBeInstanceOf(AiBudgetExceededError);
    await expect(fake.ai.embedText("A desk")).rejects.toBeInstanceOf(AiBudgetExceededError);
    expect(fake.requests).toEqual([]);
  });

  it("raises the budget error when the allowance runs out between SDK retries", async () => {
    let reservations = 0;

    const ai = createAi({
      apiKey: () => "sk-fake",
      fetch: createBudgetedFetch({
        fetch: () =>
          Promise.resolve(
            Response.json(
              { error: { message: "Rate limited", type: "rate_limit" } },
              { headers: { "retry-after-ms": "0" }, status: 429 },
            ),
          ),
        limit: () => 18_000_000,
        now: () => new Date(),
        startMonth: () => undefined,
        store: {
          reserve: () => Promise.resolve(++reservations === 1),
          settle: () => Promise.resolve(),
        },
      }),
    });

    await expect(ai.embedText("A desk")).rejects.toBeInstanceOf(AiBudgetExceededError);
    expect(reservations).toBe(2);
  });

  it("raises the not-configured error without an API key", async () => {
    const ai = createAi({ apiKey: () => undefined, fetch: vi.fn<typeof fetch>() });
    expect(ai.assertConfigured).toThrow(AiNotConfiguredError);
    await expect(ai.embedText("A desk")).rejects.toBeInstanceOf(AiNotConfiguredError);
  });
});
