import { randomBytes } from "node:crypto";

const STATE_COOKIE = "easeia_google_oauth_state";
const STATE_TTL_SECONDS = 600;

export const buildRedirectUri = (origin: string): string =>
  `${origin.replace(/\/$/v, "")}/api/google/callback`;

export const newState = (): string => randomBytes(24).toString("base64url");

type StateCookieResultContract = {
  httpOnly: true;
  maxAge: number;
  name: string;
  path: string;
  sameSite: "lax";
  secure: boolean;
  value: string;
};

export const stateCookie = (value: string): StateCookieResultContract => ({
  httpOnly: true,
  maxAge: STATE_TTL_SECONDS,
  name: STATE_COOKIE,
  path: "/",
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  value,
});

export const stateCookieName = STATE_COOKIE;
