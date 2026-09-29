import { createOpenAI } from "@ai-sdk/openai";

import { budgetedOpenAiFetch } from "./budget-fetch";

export const AI_NOT_CONFIGURED_MESSAGE =
  "Set OPENAI_API_KEY to enable AI drafts, rewrites, and similar posts.";
export const isAiConfigured = () => Boolean(process.env.OPENAI_API_KEY?.trim());

let cached: ReturnType<typeof createOpenAI> | null = null;

const getProvider = (): ReturnType<typeof createOpenAI> | null => {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (key === undefined || key === "") {
    return null;
  }
  cached ??= createOpenAI({ apiKey: key, fetch: budgetedOpenAiFetch });
  return cached;
};

export class AiNotConfiguredError extends Error {
  constructor() {
    super(AI_NOT_CONFIGURED_MESSAGE);
    this.name = "AiNotConfiguredError";
  }
}

export const requireProvider = () => {
  const provider = getProvider();
  if (!provider) {
    throw new AiNotConfiguredError();
  }
  return provider;
};

export const tryProvider = (): ReturnType<typeof createOpenAI> | null => getProvider();
