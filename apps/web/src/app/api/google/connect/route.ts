import { buildAuthUrl, GoogleNotConfiguredError } from "@repo/search-console";
import { NextResponse, type NextRequest } from "next/server";

import { getSession } from "@/lib/auth-helpers";
import { buildRedirectUri, newState, stateCookie } from "@/lib/google-oauth";

export const GET = async (req: NextRequest) => {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const state = newState();
  const redirectUri = buildRedirectUri(req.nextUrl.origin);
  let url: string;
  try {
    url = buildAuthUrl({ redirectUri, state });
  } catch (error) {
    if (error instanceof GoogleNotConfiguredError) {
      return NextResponse.redirect(
        new URL(`/dashboard/settings?google_error=${encodeURIComponent(error.message)}`, req.url),
      );
    }
    throw error;
  }
  const res = NextResponse.redirect(url);
  res.cookies.set(stateCookie(state));
  return res;
};
