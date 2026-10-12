import { createOpenAI } from "@ai-sdk/openai";
import {
  embed,
  generateImage as generateImageFile,
  generateText,
  NoObjectGeneratedError,
  Output,
  RetryError,
} from "ai";
import { z, type ZodType } from "zod";

import { budgetedOpenAiFetch } from "./budget-fetch";
import { AiBudgetExceededError, AiNotConfiguredError } from "./errors";
import { MODELS } from "./models";

const API_KEY_VAR = "OPENAI_API_KEY";
const IMAGE_QUALITY_VAR = "OPENAI_IMAGE_QUALITY";
const STRUCTURED_ATTEMPTS = 2;
const IMAGE_TIMEOUT_MS = 120_000;

const imageQualitySchema = z.enum(["low", "medium", "high"]).default("medium");

type AiTransport = {
  apiKey: () => string | undefined;
  fetch: typeof globalThis.fetch;
};

type StructuredRequest<T> = {
  prompt: string;
  schema: ZodType<T>;
};

const envValue = (name: string): string | undefined => {
  const value = process.env[name]?.trim();
  return value === undefined || value === "" ? undefined : value;
};

const surfacingBudgetError = async <T>(call: () => Promise<T>): Promise<T> => {
  try {
    return await call();
  } catch (error) {
    if (RetryError.isInstance(error) && error.lastError instanceof AiBudgetExceededError) {
      throw error.lastError;
    }
    throw error;
  }
};

const createAi = (transport: AiTransport) => {
  const requireApiKey = (): string => {
    const apiKey = transport.apiKey();
    if (apiKey === undefined) {
      throw new AiNotConfiguredError();
    }
    return apiKey;
  };

  const provider = () => createOpenAI({ apiKey: requireApiKey(), fetch: transport.fetch });

  const generateStructured = async <T>({ prompt, schema }: StructuredRequest<T>): Promise<T> => {
    const model = provider()(MODELS.text.name);
    const attempt = async (made: number): Promise<T> => {
      try {
        const { output } = await surfacingBudgetError(() =>
          generateText({ model, output: Output.object({ schema }), prompt }),
        );
        return output;
      } catch (error) {
        if (NoObjectGeneratedError.isInstance(error) && made + 1 < STRUCTURED_ATTEMPTS) {
          return attempt(made + 1);
        }
        throw error;
      }
    };
    return attempt(0);
  };

  const generateImage = async (prompt: string): Promise<Uint8Array> => {
    const model = provider().image(MODELS.image.name);
    const quality = imageQualitySchema.parse(envValue(IMAGE_QUALITY_VAR));
    const { image } = await surfacingBudgetError(() =>
      generateImageFile({
        abortSignal: AbortSignal.timeout(IMAGE_TIMEOUT_MS),
        model,
        n: 1,
        prompt,
        providerOptions: { openai: { quality } },
        size: MODELS.image.size,
      }),
    );
    return image.uint8Array;
  };

  const embedText = async (value: string): Promise<Array<number>> => {
    const model = provider().embedding(MODELS.embedding.name);
    const { embedding } = await surfacingBudgetError(() => embed({ model, value }));
    return embedding;
  };

  return {
    assertConfigured: (): void => {
      requireApiKey();
    },
    embedText,
    generateImage,
    generateStructured,
  };
};

const AI_ENV_VARS = [API_KEY_VAR] as const;

const {
  assertConfigured: assertAiConfigured,
  embedText,
  generateImage,
  generateStructured,
} = createAi({ apiKey: () => envValue(API_KEY_VAR), fetch: budgetedOpenAiFetch });

export { AI_ENV_VARS, assertAiConfigured, createAi, embedText, generateImage, generateStructured };
