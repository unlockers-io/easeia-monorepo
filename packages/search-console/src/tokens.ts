/**
 * GoogleConnection persistence: encrypts tokens at rest and refreshes them
 * lazily when an authed client is requested. Refresh writes back to the row
 * so the next call doesn't refresh again.
 */
import { prisma, type GoogleConnection, type Prisma } from "@repo/db";
import type { Credentials, OAuth2Client } from "google-auth-library";

import { decryptSecret, encryptSecret } from "./crypto";
import { GoogleAuthError, GoogleNotConnectedError } from "./errors";
import { oauthClient, SEARCH_CONSOLE_SCOPE } from "./oauth";

const REFRESH_LEEWAY_MS = 60_000;

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
  redirectUri: string;
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

const persistRefresh = async (userId: string, tokens: Credentials): Promise<void> => {
  if (
    typeof tokens.access_token !== "string" ||
    tokens.access_token === "" ||
    typeof tokens.expiry_date !== "number" ||
    tokens.expiry_date === 0
  ) {
    return;
  }
  const data: Prisma.GoogleConnectionUpdateInput = {
    accessToken: encryptSecret(tokens.access_token),
    expiresAt: new Date(tokens.expiry_date),
  };
  if (typeof tokens.refresh_token === "string" && tokens.refresh_token !== "") {
    data.refreshToken = encryptSecret(tokens.refresh_token);
  }
  await prisma.googleConnection.update({
    data,
    where: { userId },
  });
};

export const authedClient = async (params: {
  redirectUri: string;
  userId: string;
}): Promise<OAuth2Client> => {
  const row = await prisma.googleConnection.findUnique({ where: { userId: params.userId } });
  if (!row) {
    throw new GoogleNotConnectedError(params.userId);
  }
  const client = oauthClient(params.redirectUri);
  const accessToken = decryptSecret(row.accessToken);
  const refreshToken =
    row.refreshToken !== null && row.refreshToken !== "" ? decryptSecret(row.refreshToken) : null;
  client.setCredentials({
    access_token: accessToken,
    expiry_date: row.expiresAt.getTime(),
    refresh_token: refreshToken ?? undefined,
    scope: row.scope,
  });

  const expiresIn = row.expiresAt.getTime() - Date.now();
  if (expiresIn > REFRESH_LEEWAY_MS) {
    return client;
  }
  if (refreshToken === null || refreshToken === "") {
    throw new GoogleAuthError("Access token expired and no refresh token stored; reconnect");
  }
  const { credentials } = await client.refreshAccessToken();
  await persistRefresh(params.userId, credentials);
  client.setCredentials(credentials);
  return client;
};
