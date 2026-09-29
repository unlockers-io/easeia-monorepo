import { z } from "zod";

const MICRO_USD = 1_000_000;
const MAX_OUTPUT_TOKENS = 16_384;

const requestSchema = z.looseObject({
  model: z.string(),
  stream: z.boolean().optional(),
});

const tokenUsageSchema = z.object({
  input_tokens: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  output_tokens: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
});

const embeddingUsageSchema = z.object({
  prompt_tokens: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
});

const responseSchema = z.object({ usage: z.unknown() });
type ApiResponse = Parameters<typeof responseSchema.safeParse>[0];

type AiRequestPlan = {
  body: string;
  costOf: (response: ApiResponse) => number | undefined;
  reservedMicroUsd: number;
};

const monthlyBudgetMicroUsd = (): number => {
  const raw = process.env.AI_MONTHLY_BUDGET_USD?.trim();
  const dollars = Number(raw === undefined || raw === "" ? "18" : raw);
  const amount = Math.floor(dollars * MICRO_USD);
  if (!Number.isSafeInteger(amount) || amount < 0) {
    throw new Error("AI_MONTHLY_BUDGET_USD must be a nonnegative dollar amount.");
  }
  return amount;
};

const monthlyBudgetStartMonth = (): string | undefined => {
  const month = process.env.AI_BUDGET_START_MONTH?.trim();
  if (month === undefined || month === "") {
    return undefined;
  }
  if (!/^\d{4}-(?:0[1-9]|1[0-2])$/v.test(month)) {
    throw new Error("AI_BUDGET_START_MONTH must be a UTC month in YYYY-MM format.");
  }
  return month;
};

const textPartSchema = z.strictObject({ text: z.string(), type: z.literal("input_text") });
const textContentSchema = z.union([z.string(), z.array(textPartSchema)]);
const textMessageSchema = z.strictObject({
  content: textContentSchema,
  role: z.enum(["user", "assistant", "system", "developer"]),
  type: z.literal("message").optional(),
});
const textInputSchema = z.union([z.string(), z.array(textMessageSchema)]);

const tokenCost = (input: number, output: number, inputRate: number, outputRate: number) =>
  Math.ceil(input * inputRate + output * outputRate);

const usageCost = (inputRate: number, outputRate: number) => (response: ApiResponse) => {
  const envelope = responseSchema.safeParse(response);
  if (!envelope.success) {
    return undefined;
  }
  const usage = tokenUsageSchema.safeParse(envelope.data.usage);
  if (!usage.success) {
    return undefined;
  }
  const cost = tokenCost(usage.data.input_tokens, usage.data.output_tokens, inputRate, outputRate);
  return Number.isSafeInteger(cost) ? cost : undefined;
};

const textPlan = (request: z.infer<typeof requestSchema>): AiRequestPlan => {
  if (
    request.model !== "gpt-5.6-luna" ||
    request.stream === true ||
    request.previous_response_id !== undefined ||
    request.conversation !== undefined ||
    request.prompt !== undefined ||
    !textInputSchema.safeParse(request.input).success
  ) {
    throw new Error("The AI budget supports stateless, non-streaming gpt-5.6-luna text requests.");
  }
  const tools = z.array(z.object({ type: z.literal("function") })).optional();
  if (!tools.safeParse(request.tools).success) {
    throw new Error("Built-in OpenAI tools are not covered by the AI budget.");
  }
  const requestedLimit = z.number().int().positive().optional().parse(request.max_output_tokens);
  const limit = Math.min(requestedLimit ?? MAX_OUTPUT_TOKENS, MAX_OUTPUT_TOKENS);
  const body = JSON.stringify({ ...request, max_output_tokens: limit, service_tier: "default" });
  return {
    body,
    costOf: usageCost(0.4, 1.8),
    reservedMicroUsd: tokenCost(Buffer.byteLength(body) + 1024, limit, 0.4, 1.8),
  };
};

const imagePlan = (request: z.infer<typeof requestSchema>): AiRequestPlan => {
  const input = z
    .object({
      model: z.literal("gpt-image-2"),
      n: z.literal(1),
      prompt: z.string(),
      quality: z.enum(["low", "medium", "high"]),
      size: z.literal("1536x1024"),
    })
    .parse(request);
  if (request.stream === true || request.partial_images !== undefined) {
    throw new Error("Streaming images are not covered by the AI budget.");
  }
  const outputBounds = { high: 12_288, low: 512, medium: 3072 };
  const body = JSON.stringify(request);
  return {
    body,
    costOf: usageCost(5, 30),
    reservedMicroUsd: tokenCost(Buffer.byteLength(body) + 1024, outputBounds[input.quality], 5, 30),
  };
};

const embeddingPlan = (request: z.infer<typeof requestSchema>): AiRequestPlan => {
  if (request.model !== "text-embedding-3-small") {
    throw new Error("The AI budget only supports text-embedding-3-small embeddings.");
  }
  z.union([z.string(), z.array(z.string())]).parse(request.input);
  const body = JSON.stringify(request);
  return {
    body,
    costOf: (response) => {
      const envelope = responseSchema.safeParse(response);
      if (!envelope.success) {
        return undefined;
      }
      const usage = embeddingUsageSchema.safeParse(envelope.data.usage);
      return usage.success ? Math.ceil(usage.data.prompt_tokens * 0.02) : undefined;
    },
    reservedMicroUsd: Math.ceil((Buffer.byteLength(body) + 1024) * 0.02),
  };
};

const planAiRequest = (url: URL, rawBody: string): AiRequestPlan => {
  if (url.origin !== "https://api.openai.com") {
    throw new Error("The AI budget only covers requests to api.openai.com.");
  }
  const request = requestSchema.parse(JSON.parse(rawBody));
  switch (url.pathname) {
    case "/v1/responses": {
      return textPlan(request);
    }
    case "/v1/images/generations": {
      return imagePlan(request);
    }
    case "/v1/embeddings": {
      return embeddingPlan(request);
    }
    default: {
      throw new Error(`OpenAI endpoint ${url.pathname} is not covered by the AI budget.`);
    }
  }
};

export { monthlyBudgetMicroUsd, monthlyBudgetStartMonth, planAiRequest };
export type { AiRequestPlan };
