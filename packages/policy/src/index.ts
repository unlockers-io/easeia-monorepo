import { isApiKeyScope, type ApiKeyScope } from "@repo/api-types";

export type Actor =
  | { id: string; kind: "user" }
  | { id: string; kind: "apikey"; scopes: ReadonlyArray<ApiKeyScope> };

export type Action = ApiKeyScope | "api-keys:read" | "api-keys:write";

type Decision = { allowed: true } | { allowed: false; reason: string };

export const can = (actor: Actor, action: Action): Decision => {
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
  return { allowed: true };
};
