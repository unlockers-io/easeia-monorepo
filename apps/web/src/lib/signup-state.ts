import { isSignupOpen } from "@repo/auth/signup";
import { prisma } from "@repo/db";
import { connection } from "next/server";
import { cache } from "react";

import { getEnv } from "./env";

export const getSignupState = cache(async () => {
  await connection();
  const mode = getEnv().SIGNUP_MODE;
  const count = mode === "first-user" ? await prisma.user.count() : 0;
  return { mode, open: isSignupOpen(mode, count) };
});
