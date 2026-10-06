import { isApiKeyScope, isSiteScopedScope, type ApiKeyScope } from "@repo/api-types";

export type Actor =
  | { id: string; kind: "user" }
  | { id: string; kind: "apikey"; scopes: ReadonlyArray<ApiKeyScope>; siteId: string | null };

export type Action = ApiKeyScope | "api-keys:read" | "api-keys:write";

type Decision = { allowed: true } | { allowed: false; reason: string };

const reachesSite = (boundSiteId: string | null, action: ApiKeyScope, siteId?: string) =>
  boundSiteId === null || siteId === undefined
    ? !isSiteScopedScope(action)
    : boundSiteId === siteId;

export const can = (actor: Actor, action: Action, siteId?: string): Decision => {
  if (actor.kind === "user") {
    return { allowed: true };
  }
  // Admin-only means "not a scope", so the two lists cannot drift apart.
  if (!isApiKeyScope(action)) {
    return { allowed: false, reason: `Action requires admin session: ${action}` };
  }
  if (!actor.scopes.includes(action)) {
    return { allowed: false, reason: `Missing scope: ${action}` };
  }
  if (!reachesSite(actor.siteId, action, siteId)) {
    return { allowed: false, reason: "API key is not scoped to this site" };
  }
  return { allowed: true };
};
