import { type Prisma, prisma } from "@repo/db";
import type { Context } from "hono";

import { getActor } from "./actor";

type AuditInput = { action: string; meta?: Prisma.InputJsonValue; target: string };
type WriteAudit = (data: {
  action: string;
  actor: string;
  meta: Prisma.InputJsonValue;
  target: string;
}) => Promise<void>;

const createRecordAudit =
  (writeAudit: WriteAudit) =>
  async (c: Context, input: AuditInput): Promise<void> => {
    const actor = getActor(c);
    if (actor === undefined) {
      return;
    }
    try {
      await writeAudit({
        action: input.action,
        actor: `${actor.kind}:${actor.id}`,
        meta: input.meta ?? {},
        target: input.target,
      });
    } catch (error) {
      c.get("log").warn("failed to write AuditLog", {
        action: input.action,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

const recordAudit = createRecordAudit(async (data) => {
  await prisma.auditLog.create({ data });
});

export { createRecordAudit, recordAudit };
export type { WriteAudit };
