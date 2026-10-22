import { refillAll, type Refill } from "./bucket";
import { publishDue, type PublishDueResult } from "./publish";

export type TickResult = Omit<PublishDueResult, "failed"> & { refills: Array<Refill> };

export const tick = async (now = new Date()): Promise<TickResult> => {
  const { failed, ...published } = await publishDue(now);
  // oxlint-disable-next-line react-doctor/server-sequential-independent-await -- not independent: refillAll counts the bucket drafts publishDue just claimed
  const refills = await refillAll();

  if (failed.length > 0) {
    throw new AggregateError(
      failed.map((failure) => failure.error),
      `auto-publish failed: ${failed.map((failure) => `${failure.siteId}: ${failure.error.message}`).join("; ")}`,
    );
  }

  return { ...published, refills };
};

export {
  AutoPublishConfigError,
  applyNetworkDefaults,
  configure,
  type AutoPublishInput,
  type NetworkDefaultsInput,
} from "./config";

export { readBuckets, refill, refillAll } from "./bucket";

export { publishDraft, publishNext } from "./publish";
