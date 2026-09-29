import { exchangeCode, GoogleAuthError, storeConnection } from "@repo/search-console";
import { NextResponse, type NextRequest } from "next/server";

import { getSession } from "@/lib/auth-helpers";
import { buildRedirectUri, stateCookieName } from "@/lib/google-oauth";

const decodeIdTokenEmail = (idToken: string | null | undefined): string | null => {
  if (idToken === undefined || idToken === null || idToken === "") {
    return null;
  }
  const segment = idToken.split(".").at(1);
  if (segment === undefined || segment === "") {
    return null;
  }
  try {
    const payload: unknown = JSON.parse(
      Buffer.from(segment.replaceAll("-", "+").replaceAll("_", "/"), "base64").toString("utf8"),
    );
    if (
      typeof payload === "object" &&
      payload !== null &&
      "email" in payload &&
      typeof payload.email === "string"
    ) {
      return payload.email;
    }
    return null;
  } catch {
    return null;
  }
};

const settingsRedirect = (origin: string, params: Record<string, string>): NextResponse => {
  const url = new URL("/dashboard/settings", origin);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  const res = NextResponse.redirect(url);
  res.cookies.delete(stateCookieName);
  return res;
};

export const GET = async (req: NextRequest) => {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = req.nextUrl;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const errorParam = url.searchParams.get("error");
  if (errorParam !== null && errorParam !== "") {
    return settingsRedirect(url.origin, { google_error: errorParam });
  }
  if (code === null || code === "" || state === null || state === "") {
    return settingsRedirect(url.origin, { google_error: "missing_params" });
  }
  const cookieState = req.cookies.get(stateCookieName)?.value;
  if (cookieState === undefined || cookieState === "" || cookieState !== state) {
    return settingsRedirect(url.origin, { google_error: "state_mismatch" });
  }
  const redirectUri = buildRedirectUri(url.origin);
  try {
    const tokens = await exchangeCode({ code, redirectUri });
    await storeConnection({
      googleEmail: decodeIdTokenEmail(tokens.id_token),
      redirectUri,
      tokens,
      userId: session.user.id,
    });
  } catch (error) {
    const message = error instanceof GoogleAuthError ? error.message : "exchange_failed";
    return settingsRedirect(url.origin, { google_error: message });
  }
  return settingsRedirect(url.origin, { google_connected: "1" });
};
