import { JobKind, prisma, type Prisma, type Site } from "@repo/db";
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

const recordRedeploy = async (
  siteId: string,
  tx: Prisma.TransactionClient,
): Promise<RedeployOutcome> => {
  const site = await tx.site.findUniqueOrThrow({ where: { id: siteId } });
  const target = deployTarget(site);
  if (!(target instanceof URL)) {
    return target;
  }
  const job = await enqueueUnlessQueued(
    {
      delayMs: REDEPLOY_WINDOW_MS,
      kind: JobKind.TRIGGER_DEPLOY,
      payload: { siteId },
      siteId,
    },
    tx,
  );
  return job === null ? "coalesced" : "queued";
};

export const requestRedeploy = (
  siteId: string,
  tx?: Prisma.TransactionClient,
): Promise<RedeployOutcome> =>
  tx === undefined
    ? prisma.$transaction((db) => recordRedeploy(siteId, db))
    : recordRedeploy(siteId, tx);

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
