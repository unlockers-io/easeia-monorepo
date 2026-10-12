import { type Prisma, prisma } from "@repo/db";
import { log } from "@repo/observability";

import type { Actor } from "./authorize";

export type AuditEntry = { action: string; meta?: Prisma.InputJsonValue; target: string };

export const recordAudit = async (actor: Actor, entry: AuditEntry): Promise<void> => {
  try {
    await prisma.auditLog.create({
      data: {
        action: entry.action,
        actor: `${actor.kind}:${actor.id}`,
        meta: entry.meta ?? {},
        target: entry.target,
      },
    });
  } catch (error) {
    log.warn({
      action: entry.action,
      error: error instanceof Error ? error.message : String(error),
      message: "failed to write AuditLog",
    });
  }
};
