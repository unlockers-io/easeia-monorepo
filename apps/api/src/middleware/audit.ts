import * as Policy from "@repo/policy";
import type { Context } from "hono";

import type { AuthVariables } from "./api-auth";

export const recordAudit = (c: Context<{ Variables: AuthVariables }>, entry: Policy.AuditEntry) =>
  Policy.recordAudit(c.get("actor"), entry);
