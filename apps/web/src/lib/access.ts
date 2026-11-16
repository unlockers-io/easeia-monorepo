import "server-only";

import { recordAudit, type AuditEntry } from "@repo/policy";

import { getPrisma } from "@/lib/db";

import { requireSession } from "./auth-helpers";

export const audit = async (entry: AuditEntry): Promise<void> => {
  const session = await requireSession();
  await recordAudit(getPrisma(), { id: session.user.id, kind: "user" }, entry);
};
