import { OAuth2Client, type Credentials } from "google-auth-library";

import { GoogleNotConfiguredError } from "./errors";

export const isGoogleConfigured = () =>
  (process.env.GOOGLE_OAUTH_CLIENT_ID?.trim() ?? "") !== "" &&
  (process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim() ?? "") !== "";

export const SEARCH_CONSOLE_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";

type OAuthEnv = {
  clientId: string;
  clientSecret: string;
};

const loadEnv = (): OAuthEnv => {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
  if (
    clientId === undefined ||
    clientId === "" ||
    clientSecret === undefined ||
    clientSecret === ""
  ) {
    throw new GoogleNotConfiguredError(
      "GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET must be set",
    );
  }
  return { clientId, clientSecret };
};

export const oauthClient = (redirectUri: string): OAuth2Client => {
  const env = loadEnv();
  return new OAuth2Client({
    clientId: env.clientId,
    clientSecret: env.clientSecret,
    redirectUri,
  });
};

export const buildAuthUrl = (params: { redirectUri: string; state: string }): string => {
  const client = oauthClient(params.redirectUri);
  return client.generateAuthUrl({
    access_type: "offline",
    include_granted_scopes: true,
    prompt: "consent",
    scope: [SEARCH_CONSOLE_SCOPE],
    state: params.state,
  });
};

export const exchangeCode = async (params: {
  code: string;
  redirectUri: string;
}): Promise<Credentials> => {
  const client = oauthClient(params.redirectUri);
  const { tokens } = await client.getToken(params.code);
  return tokens;
};
