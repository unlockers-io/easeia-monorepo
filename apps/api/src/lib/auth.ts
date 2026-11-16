import { envAuthConfig } from "@repo/auth/env-config";
import { createSessionReader } from "@repo/auth/server";

import { prisma } from "./db";
import { env } from "./env";

export const sessions = createSessionReader({
  ...envAuthConfig(env),
  prisma,
  secret: env.BETTER_AUTH_SECRET,
});
