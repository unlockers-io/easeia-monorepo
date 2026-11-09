import type { ConsumerContext } from "@repo/jobs";
import { createJobLogger } from "@repo/observability/worker";
import { deploy } from "@repo/sites";

export const handleTriggerDeploy = async (
  ctx: ConsumerContext<"TRIGGER_DEPLOY">,
): Promise<void> => {
  const { siteId } = ctx.payload;
  const log = createJobLogger({ jobId: ctx.jobId, queue: "trigger-deploy" });
  log.set({ siteId });
  const outcome = await deploy(siteId, fetch);
  log.set({ outcome });
  log.info("trigger-deploy: done");
  log.emit();
};
