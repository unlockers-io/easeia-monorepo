import { asLoggableError, fanoutRejections } from "@repo/jobs";

import type { createJobLogger } from "./logger";

type JobLog = Pick<ReturnType<typeof createJobLogger>, "emit" | "error">;

export type FanoutTask = {
  id: string;
  run: () => Promise<void>;
};

export const settleFanout = async (
  tasks: ReadonlyArray<FanoutTask>,
  message: string,
  log: JobLog,
): Promise<void> => {
  // Mapped, not awaited in sequence: the promises must all be created before
  // the first await or the fan-out silently becomes serial.
  const settled = await Promise.allSettled(tasks.map((t) => t.run()));
  const rejections = fanoutRejections(settled);
  for (const { index, reason } of rejections) {
    log.error(asLoggableError(reason), { enqueueFailedFor: tasks[index]?.id });
  }
  if (rejections.length > 0) {
    log.emit();
    throw new Error(`${message}: ${rejections.length}/${tasks.length} enqueues failed`);
  }
};

export type { JobLog };
