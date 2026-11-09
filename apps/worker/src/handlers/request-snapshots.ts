import { log } from "@repo/observability";
import * as Sites from "@repo/sites";

export const handleRequestSnapshots = async (): Promise<void> => {
  const { queued } = await Sites.requestSnapshots();
  log.info({ message: "snapshots requested", queued });
};
