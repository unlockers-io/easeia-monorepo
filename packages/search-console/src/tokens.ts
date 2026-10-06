import { prisma, type GoogleConnection } from "@repo/db";
import type { Credentials } from "google-auth-library";

import { encryptSecret } from "./crypto";
import { GoogleAuthError } from "./errors";
import { SEARCH_CONSOLE_SCOPE } from "./oauth";

export type GoogleConnectionPublic = Omit<GoogleConnection, "accessToken" | "refreshToken">;

const stripTokens = (row: GoogleConnection): GoogleConnectionPublic => {
  const { accessToken: _a, refreshToken: _r, ...rest } = row;
  return rest;
};

export const loadConnection = async (userId: string): Promise<GoogleConnectionPublic | null> => {
  const row = await prisma.googleConnection.findUnique({ where: { userId } });
  return row ? stripTokens(row) : null;
};

export const disconnect = async (userId: string): Promise<void> => {
  await prisma.googleConnection.deleteMany({ where: { userId } });
};

export const storeConnection = async (params: {
  googleEmail: string | null;
  tokens: Credentials;
  userId: string;
}): Promise<GoogleConnectionPublic> => {
  if (typeof params.tokens.access_token !== "string" || params.tokens.access_token === "") {
    throw new GoogleAuthError("Google did not return an access token");
  }
  if (typeof params.tokens.expiry_date !== "number" || params.tokens.expiry_date === 0) {
    throw new GoogleAuthError("Google did not return token expiry");
  }

  // stored with no refresh token: it reports healthy, works for one hour, then
  // is permanently dead, and the failure surfaces a week later as a page crash
  // rather than here, where the callback route already renders it. The OAuth
  // request sets access_type=offline + prompt=consent, so a missing refresh
  // token means the exchange genuinely did not return one.
  if (typeof params.tokens.refresh_token !== "string" || params.tokens.refresh_token === "") {
    throw new GoogleAuthError("Google did not return a refresh token; reconnect and re-consent");
  }
  const accessToken = encryptSecret(params.tokens.access_token);
  const refreshToken = encryptSecret(params.tokens.refresh_token);
  const data = {
    accessToken,
    expiresAt: new Date(params.tokens.expiry_date),
    googleEmail: params.googleEmail,
    refreshToken,
    scope: params.tokens.scope ?? SEARCH_CONSOLE_SCOPE,
    userId: params.userId,
  };
  const row = await prisma.googleConnection.upsert({
    create: data,
    update: data,
    where: { userId: params.userId },
  });
  return stripTokens(row);
};
