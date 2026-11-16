import { isSignupOpen } from "@repo/auth/signup";
import { connection } from "next/server";
import { cache } from "react";

import { getPrisma } from "@/lib/db";

import { getEnv } from "./env";

export const getSignupState = cache(async () => {
  await connection();
  const mode = getEnv().SIGNUP_MODE;
  const count = mode === "first-user" ? await getPrisma().user.count() : 0;

  return { mode, open: isSignupOpen(mode, count) };
});
