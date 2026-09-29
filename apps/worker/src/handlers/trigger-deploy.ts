import { prisma } from "@repo/db";
import type { ConsumerContext } from "@repo/jobs";
import { parseDeployHook } from "@repo/sites";

import { createJobLogger } from "../lib/logger";

type LoadSiteFn = (siteId: string) => Promise<{
  domain: string;
  id: string;
  vercelDeployHookUrl: string | null;
} | null>;

type TriggerDeployLog = Pick<ReturnType<typeof createJobLogger>, "emit" | "info" | "set" | "warn">;

type TriggerDeployDependencies = {
  createLogger: (context: Parameters<typeof createJobLogger>[0]) => TriggerDeployLog;
  fetchHook: typeof fetch;
  loadSite: LoadSiteFn;
};

const createHandleTriggerDeploy = (dependencies: TriggerDeployDependencies) =>
  async function handleTriggerDeploy(ctx: ConsumerContext<"TRIGGER_DEPLOY">): Promise<void> {
    const { siteId } = ctx.payload;
    const log = dependencies.createLogger({ jobId: ctx.jobId, queue: "trigger-deploy" });
    log.set({ siteId });
    const site = await dependencies.loadSite(siteId);
    if (!site) {
      log.warn("trigger-deploy: site not found");
      log.emit();
      return;
    }
    const hook = parseDeployHook(site.vercelDeployHookUrl);
    if (hook === null) {
      log.set({ domain: site.domain });
      log.info("trigger-deploy: no usable hook URL, skipping");
      log.emit();
      return;
    }
    const res = await dependencies.fetchHook(hook.toString(), {
      method: "POST",
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) {
      throw new Error(`Deploy hook returned ${res.status}: ${await res.text()}`);
    }
    log.set({ domain: site.domain, status: res.status });
    log.info("trigger-deploy: posted");
    log.emit();
  };

const handleTriggerDeploy = createHandleTriggerDeploy({
  createLogger: createJobLogger,
  fetchHook: fetch,
  loadSite: (siteId) =>
    prisma.site.findUnique({
      select: { domain: true, id: true, vercelDeployHookUrl: true },
      where: { id: siteId },
    }),
});

export { createHandleTriggerDeploy, handleTriggerDeploy };
export type { LoadSiteFn, TriggerDeployDependencies };
