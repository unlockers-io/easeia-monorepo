import { JobKind, type Site } from "@repo/db";
import { enqueueUnlessQueued } from "@repo/jobs";

import { parseDeployHook } from "./deploy-hook";
import { load } from "./load";

const DEPLOY_HOOK_TIMEOUT_MS = 30_000;
const REDEPLOY_WINDOW_MS = 60_000;

type Undeployable = "disabled" | "no-deploy-hook";

type RedeployOutcome = "coalesced" | "queued" | Undeployable;

type DeployOutcome = "posted" | Undeployable;

type PostDeployHook = (hook: URL, init: RequestInit) => Promise<Response>;

const deployTarget = (site: Site): URL | Undeployable =>
  site.isEnabled ? (parseDeployHook(site.vercelDeployHookUrl) ?? "no-deploy-hook") : "disabled";

export const requestRedeploy = async (siteId: string): Promise<RedeployOutcome> => {
  const target = deployTarget(await load(siteId));
  if (!(target instanceof URL)) {
    return target;
  }
  const job = await enqueueUnlessQueued({
    delayMs: REDEPLOY_WINDOW_MS,
    kind: JobKind.TRIGGER_DEPLOY,
    payload: { siteId },
    siteId,
  });
  return job === null ? "coalesced" : "queued";
};

export const deploy = async (siteId: string, postHook: PostDeployHook): Promise<DeployOutcome> => {
  const target = deployTarget(await load(siteId));
  if (!(target instanceof URL)) {
    return target;
  }
  const response = await postHook(target, {
    method: "POST",
    signal: AbortSignal.timeout(DEPLOY_HOOK_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`Deploy hook returned ${response.status}: ${await response.text()}`);
  }
  return "posted";
};
