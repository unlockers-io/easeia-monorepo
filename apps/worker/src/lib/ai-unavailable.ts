import { AiNotConfiguredError, AiUnavailableError } from "@repo/ai";
import { type ConsumerContext, JobKind, JobSkippedError } from "@repo/jobs";

import { log } from "./logger";

type Handler<K extends JobKind> = (ctx: ConsumerContext<K>) => Promise<void>;

const AI_OPTIONAL_KINDS: ReadonlySet<JobKind> = new Set([
  JobKind.CLASSIFY,
  JobKind.EMBED,
  JobKind.GENERATE_BODY_IMAGES,
  JobKind.GENERATE_IMAGE,
]);

export const isRetryable = (cause: unknown): boolean => !(cause instanceof AiUnavailableError);

export const skipOptionalAiWhenUnconfigured = <K extends JobKind>(
  kind: K,
  handler: Handler<K>,
): Handler<K> => {
  if (!AI_OPTIONAL_KINDS.has(kind)) {
    return handler;
  }

  return async (ctx) => {
    try {
      await handler(ctx);
    } catch (error) {
      if (!(error instanceof AiNotConfiguredError)) {
        throw error;
      }

      log.warn({ jobId: ctx.jobId, kind, message: "AI is not configured; job skipped" });
      throw new JobSkippedError("AI is not configured");
    }
  };
};
