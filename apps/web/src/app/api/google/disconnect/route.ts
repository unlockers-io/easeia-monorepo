import { disconnect } from "@repo/search-console";
import { NextResponse, type NextRequest } from "next/server";

import { getSession } from "@/lib/auth-helpers";
import { getPrisma } from "@/lib/db";

export const POST = async (req: NextRequest) => {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  await disconnect(getPrisma(), session.user.id);
  const url = new URL("/dashboard/settings", req.nextUrl.origin);
  url.searchParams.set("google_disconnected", "1");

  return NextResponse.redirect(url, { status: 303 });
};
