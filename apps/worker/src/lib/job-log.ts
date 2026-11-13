import type { JobKind } from "@repo/db";
import { type ConsumerContext, JobSkippedError } from "@repo/jobs";
import { createJobLogger } from "@repo/observability/worker";

type Logger = ReturnType<typeof createJobLogger>;

export type JobLog = Pick<Logger, "info" | "set" | "warn">;

export type JobContext<K extends JobKind> = ConsumerContext<K> & { log: JobLog };

export type Handler<K extends JobKind> = (ctx: JobContext<K>) => Promise<void>;

type CreateLog = (context: {
  jobId: string;
  queue: string;
}) => JobLog & Pick<Logger, "emit" | "error">;

export const makeWithJobLog =
  (createLog: CreateLog) =>
  <K extends JobKind>(kind: K, handle: Handler<K>) =>
  async (ctx: ConsumerContext<K>): Promise<void> => {
    const log = createLog({ jobId: ctx.jobId, queue: kind.toLowerCase().replaceAll("_", "-") });

    try {
      await handle({ ...ctx, log });
    } catch (error) {
      if (error instanceof JobSkippedError) {
        log.warn(error.message);
      } else {
        log.error(error instanceof Error ? error : String(error));
      }

      throw error;
    } finally {
      log.emit();
    }
  };

export const withJobLog = makeWithJobLog(createJobLogger);
