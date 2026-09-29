import { apiKeyCreateSchema, mintApiKeyToken } from "@repo/api-types";

type ApiKeyRecord = {
  hash: string;
  name: string;
  prefix: string;
  scopes: Array<string>;
  siteId?: string;
};

type ApiKeyActionDependencies = {
  createKey: (record: ApiKeyRecord) => Promise<{ id: string }>;
  requireSession: () => Promise<void>;
  revalidate: (path: string) => void;
  revokeKey: (id: string) => Promise<void>;
};

const createApiKeyActions = (dependencies: ApiKeyActionDependencies) => {
  const createApiKeyAction = async (formData: FormData) => {
    await dependencies.requireSession();
    const rawName = formData.get("name");
    const rawSiteId = formData.get("siteId");
    const parsed = apiKeyCreateSchema.safeParse({
      name: typeof rawName === "string" ? rawName.trim() : rawName,
      scopes: formData.getAll("scopes").filter((raw) => typeof raw === "string"),
      siteId: typeof rawSiteId === "string" && rawSiteId !== "" ? rawSiteId : undefined,
    });
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Invalid API key configuration" };
    }

    const { hash, prefix, token } = mintApiKeyToken();
    const created = await dependencies.createKey({
      hash,
      name: parsed.data.name,
      prefix,
      scopes: parsed.data.scopes,
      siteId: parsed.data.siteId,
    });
    dependencies.revalidate("/dashboard/api-keys");
    return { keyId: created.id, token };
  };

  const revokeApiKeyAction = async (formData: FormData) => {
    await dependencies.requireSession();
    const id = formData.get("id");
    if (typeof id !== "string" || id === "") {
      throw new Error("id is required");
    }
    await dependencies.revokeKey(id);
    dependencies.revalidate("/dashboard/api-keys");
  };

  return { createApiKeyAction, revokeApiKeyAction };
};

export { createApiKeyActions };
export type { ApiKeyActionDependencies, ApiKeyRecord };
