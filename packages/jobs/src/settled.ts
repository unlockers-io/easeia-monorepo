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

export { asLoggableError, fanoutRejections };
export type { FanoutRejection };
