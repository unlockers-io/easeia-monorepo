import { AiNotConfiguredError, AiUnavailableError } from "@repo/ai";
import type { JobKind } from "@repo/db";
import { type ConsumerContext, JobSkippedError } from "@repo/jobs";
import { log } from "@repo/observability";

type Handler<K extends JobKind> = (ctx: ConsumerContext<K>) => Promise<void>;

export const isRetryable = (cause: unknown): boolean => !(cause instanceof AiUnavailableError);

export const skipWhenAiUnconfigured =
  <K extends JobKind>(handler: Handler<K>): Handler<K> =>
  async (ctx) => {
    try {
      await handler(ctx);
    } catch (error) {
      if (!(error instanceof AiNotConfiguredError)) {
        throw error;
      }

      log.warn({ jobId: ctx.jobId, message: "AI is not configured; job skipped" });
      throw new JobSkippedError("AI is not configured");
    }
  };
