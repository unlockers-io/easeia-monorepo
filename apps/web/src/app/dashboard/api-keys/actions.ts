"use server";

import type { ApiKeyCreate } from "@repo/api-types";
import { createApiKey, revokeApiKey } from "@repo/policy";
import { revalidatePath } from "next/cache";

import { audit } from "@/lib/access";
import { getPrisma } from "@/lib/db";
import { withAuth } from "@/lib/server-action";

export const createApiKeyAction = async (input: ApiKeyCreate) =>
  withAuth(async () => {
    const issued = await createApiKey(getPrisma(), input);
    await audit({
      action: "apikey.create",
      meta: { scopes: issued.scopes },
      target: `apikey:${issued.id}`,
    });
    revalidatePath("/dashboard/api-keys");

    return issued.token;
  });

export const revokeApiKeyAction = async (id: string) =>
  withAuth(async () => {
    await revokeApiKey(getPrisma(), id);
    await audit({ action: "apikey.revoke", target: `apikey:${id}` });
    revalidatePath("/dashboard/api-keys");
  });
