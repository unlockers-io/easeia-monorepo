import { createHash, randomBytes } from "node:crypto";

import { apiKeyCreateSchema, isApiKeyScope, type ApiKeyCreate } from "@repo/api-types";
import { prisma } from "@repo/db";

import type { Actor } from "./authorize";
import { InvalidApiKeyError } from "./errors";

const BEARER_PREFIX = "Bearer ";
const TOKEN_NAMESPACE = "easeia_live_";
const TOKEN_ENTROPY_BYTES = 18;
const DISPLAY_PREFIX_LENGTH = 16;

const summaryFields = {
  createdAt: true,
  id: true,
  lastUsed: true,
  name: true,
  prefix: true,
  revokedAt: true,
  scopes: true,
  siteId: true,
} as const;

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

const withKnownScopes = <Key extends { scopes: Array<string> }>(key: Key) => ({
  ...key,
  scopes: key.scopes.filter(isApiKeyScope),
});

const bearerToken = (authorization: string | undefined) => {
  if (authorization === undefined || !authorization.startsWith(BEARER_PREFIX)) {
    return undefined;
  }
  const token = authorization.slice(BEARER_PREFIX.length).trim();
  return token.startsWith(TOKEN_NAMESPACE) ? token : undefined;
};

export const authenticate = async (authorization: string | undefined): Promise<Actor | null> => {
  const token = bearerToken(authorization);
  if (token === undefined) {
    return null;
  }
  const [key] = await prisma.apiKey.updateManyAndReturn({
    data: { lastUsed: new Date() },
    select: { id: true, scopes: true, siteId: true },
    where: { hash: hashToken(token), revokedAt: null },
  });
  if (key === undefined) {
    throw new InvalidApiKeyError();
  }
  return { kind: "apikey", ...withKnownScopes(key) };
};

export const createApiKey = async (input: ApiKeyCreate) => {
  const { name, scopes, siteId } = apiKeyCreateSchema.parse(input);
  const token = `${TOKEN_NAMESPACE}${randomBytes(TOKEN_ENTROPY_BYTES).toString("base64url")}`;
  const key = await prisma.apiKey.create({
    data: {
      hash: hashToken(token),
      name,
      prefix: token.slice(0, DISPLAY_PREFIX_LENGTH),
      scopes,
      siteId,
    },
    select: summaryFields,
  });
  return { ...withKnownScopes(key), token };
};

export const listApiKeys = async () => {
  const keys = await prisma.apiKey.findMany({
    orderBy: { createdAt: "desc" },
    select: summaryFields,
  });
  return keys.map(withKnownScopes);
};

export const revokeApiKey = async (id: string): Promise<void> => {
  await prisma.apiKey.update({ data: { revokedAt: new Date() }, where: { id } });
};
