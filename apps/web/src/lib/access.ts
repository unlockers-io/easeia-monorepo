import "server-only";

import { recordAudit, type AuditEntry } from "@repo/policy";

import { requireSession } from "./auth-helpers";

export const audit = async (entry: AuditEntry): Promise<void> => {
  const session = await requireSession();
  await recordAudit({ id: session.user.id, kind: "user" }, entry);
};
