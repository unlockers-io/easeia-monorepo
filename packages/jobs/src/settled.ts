type FanoutRejection = {
  index: number;
  reason: Error | string;
};

const fanoutRejections = (
  settled: ReadonlyArray<PromiseSettledResult<unknown>>,
): ReadonlyArray<FanoutRejection> => {
  const out: Array<FanoutRejection> = [];

  for (const [index, result] of settled.entries()) {
    if (result.status === "rejected") {
      const reason = result.reason instanceof Error ? result.reason : String(result.reason);
      out.push({ index, reason });
    }
  }

  return out;
};

const asLoggableError = (reason: FanoutRejection["reason"]): Error | string => reason;

type FanoutTask = {
  id: string;
  run: () => Promise<void>;
};

type FanoutLog = {
  emit: () => void;
  error: (error: Error | string, context: { enqueueFailedFor: string | undefined }) => void;
};

const settleFanout = async (
  tasks: ReadonlyArray<FanoutTask>,
  message: string,
  log: FanoutLog,
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

export { asLoggableError, fanoutRejections, settleFanout };

export type { FanoutTask };
