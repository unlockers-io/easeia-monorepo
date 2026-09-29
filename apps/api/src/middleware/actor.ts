import { apiKeyScopeSchema } from "@repo/api-types";
import type { Actor } from "@repo/policy";
import type { Context } from "hono";
import { z } from "zod";

export type AuthActor =
  | Extract<Actor, { kind: "user" }>
  | (Extract<Actor, { kind: "apikey" }> & { siteId: string | null });

export type AuthVariables = {
  actor: AuthActor;
};

const authActorSchema = z.discriminatedUnion("kind", [
  z.object({ id: z.string(), kind: z.literal("user") }),
  z.object({
    id: z.string(),
    kind: z.literal("apikey"),
    scopes: z.array(apiKeyScopeSchema),
    siteId: z.string().nullable(),
  }),
]);

type AuthActorInput = Parameters<typeof authActorSchema.safeParse>[0];

const isAuthActor = (value: AuthActorInput): value is AuthActor =>
  authActorSchema.safeParse(value).success;

export const getActor = (c: Context): AuthActor | undefined => {
  const actor: unknown = c.get("actor");
  return isAuthActor(actor) ? actor : undefined;
};
