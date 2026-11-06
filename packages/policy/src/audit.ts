import { type Prisma, prisma } from "@repo/db";

import type { Actor } from "./authorize";

type AuditAction =
  | "apikey.create"
  | "apikey.revoke"
  | "backfill.trigger"
  | "backlinks.backfill"
  | "backlinks.import"
  | "bucket.refill"
  | "link.approve"
  | "link.reject"
  | "link.update"
  | "moneysite.create"
  | "moneysite.delete"
  | "moneysite.recrawl"
  | "moneysite.update"
  | "post.create"
  | "post.delete"
  | "post.publish"
  | "post.unpublish"
  | "post.update"
  | "rewrite.trigger"
  | "site.create"
  | "site.update"
  | "snapshot.refresh";

export type AuditEntry = { action: AuditAction; meta?: Prisma.InputJsonValue; target: string };

export const recordAudit = async (actor: Actor, entry: AuditEntry): Promise<void> => {
  await prisma.auditLog.create({
    data: {
      action: entry.action,
      actor: `${actor.kind}:${actor.id}`,
      meta: entry.meta ?? {},
      target: entry.target,
    },
  });
};
