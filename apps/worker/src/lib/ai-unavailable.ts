import { AiNotConfiguredError, AiUnavailableError } from "@repo/ai";
import { JobSkippedError } from "@repo/jobs";

export const isRetryable = (cause: unknown): boolean => !(cause instanceof AiUnavailableError);

export const skipWhenAiUnconfigured =
  <Context>(handler: (ctx: Context) => Promise<void>) =>
  async (ctx: Context): Promise<void> => {
    try {
      await handler(ctx);
    } catch (error) {
      if (!(error instanceof AiNotConfiguredError)) {
        throw error;
      }

      throw new JobSkippedError("AI is not configured");
    }
  };
