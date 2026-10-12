import { z } from "zod";

import { createBudgetedFetch } from "./budget-fetch";
import type { AiBudgetStore } from "./budget-store";
import { createAi } from "./client";
import { MODELS } from "./models";

const openAiRequestSchema = z.object({
  model: z.string(),
  n: z.number().optional(),
  prompt: z.string().optional(),
  quality: z.string().optional(),
  size: z.string().optional(),
});

type OpenAiRequest = {
  body: z.infer<typeof openAiRequestSchema>;
  path: string;
};

type FakeOpenAiOptions = {
  allowanceMicroUsd?: number;
};

const PNG_1X1 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

const EMBEDDING_PAYLOAD = {
  data: [{ embedding: Array.from({ length: MODELS.embedding.dimensions }, () => 0.01), index: 0 }],
  usage: { prompt_tokens: 8, total_tokens: 8 },
};

const IMAGE_PAYLOAD = {
  created: 0,
  data: [{ b64_json: PNG_1X1 }],
  usage: { input_tokens: 50, output_tokens: 1000 },
};

const responsesPayload = (text: string) => ({
  created_at: 0,
  id: "resp_fake",
  model: MODELS.text.name,
  output: [
    {
      content: [{ annotations: [], text, type: "output_text" }],
      id: "msg_fake",
      role: "assistant",
      status: "completed",
      type: "message",
    },
  ],
  status: "completed",
  usage: { input_tokens: 100, output_tokens: 200 },
});

export const createFakeOpenAi = ({ allowanceMicroUsd = 18_000_000 }: FakeOpenAiOptions = {}) => {
  const requests: Array<OpenAiRequest> = [];
  const outputs: Array<string> = [];
  let spentMicroUsd = 0;

  const store: AiBudgetStore = {
    reserve: (_month, amount, limit) => {
      if (spentMicroUsd + amount > limit) {
        return Promise.resolve(false);
      }
      spentMicroUsd += amount;
      return Promise.resolve(true);
    },
    settle: (_month, reserved, cost) => {
      spentMicroUsd += cost - reserved;
      return Promise.resolve();
    },
  };

  const respond = (path: string): Response => {
    switch (path) {
      case "/v1/embeddings": {
        return Response.json(EMBEDDING_PAYLOAD);
      }
      case "/v1/images/generations": {
        return Response.json(IMAGE_PAYLOAD);
      }
      case "/v1/responses": {
        const text = outputs.shift();
        if (text === undefined) {
          throw new Error("The fake OpenAI has no queued structured output");
        }
        return Response.json(responsesPayload(text));
      }
      default: {
        throw new Error(`The fake OpenAI does not serve ${path}`);
      }
    }
  };

  const openAi: typeof globalThis.fetch = async (input, init) => {
    const request = new Request(input, init);
    const path = new URL(request.url).pathname;
    requests.push({ body: openAiRequestSchema.parse(await request.json()), path });
    return respond(path);
  };

  return {
    ai: createAi({
      apiKey: () => "sk-fake",
      fetch: createBudgetedFetch({
        fetch: openAi,
        limit: () => allowanceMicroUsd,
        now: () => new Date(),
        startMonth: () => undefined,
        store,
      }),
    }),
    queueOutputs: (...values: ReadonlyArray<object>): void => {
      outputs.push(...values.map((value) => JSON.stringify(value)));
    },
    requests,
    spentMicroUsd: (): number => spentMicroUsd,
  };
};
