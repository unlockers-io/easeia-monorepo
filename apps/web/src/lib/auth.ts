import { envAuthConfig } from "@repo/auth/env-config";
import { createAuth } from "@repo/auth/server";
import { prisma } from "@repo/db";
import { nextCookies } from "better-auth/next-js";

import { getEnv } from "./env";

type Auth = ReturnType<typeof createAuth>;
type AuthOptions = Parameters<typeof createAuth>[0];

const createGetAuth = <AuthResult>(
  create: (options: AuthOptions) => AuthResult,
  readEnv: typeof getEnv = getEnv,
) => {
  let cachedAuth: AuthResult | undefined;
  return (): AuthResult => {
    if (cachedAuth !== undefined) {
      return cachedAuth;
    }
    const env = readEnv();
    cachedAuth = create({
      ...envAuthConfig(),
      extraPlugins: [nextCookies()],
      fromEmail: env.FROM_EMAIL,
      prisma,
      resendApiKey: env.RESEND_API_KEY,
      secret: env.BETTER_AUTH_SECRET,
      signupMode: env.SIGNUP_MODE,
    });
    return cachedAuth;
  };
};

const getAuth: () => Auth = createGetAuth(createAuth);

export { createGetAuth, getAuth };
