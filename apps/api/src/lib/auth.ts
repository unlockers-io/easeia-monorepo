import { envAuthConfig } from "@repo/auth/env-config";
import { createAuth } from "@repo/auth/server";
import { prisma } from "@repo/db";

import { env } from "./env";

export const auth = createAuth({
  ...envAuthConfig(),
  prisma,
  secret: env.BETTER_AUTH_SECRET,
});
