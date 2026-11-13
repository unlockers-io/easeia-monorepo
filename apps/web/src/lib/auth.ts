import { envAuthConfig } from "@repo/auth/env-config";
import { createAuth, type Auth, type AuthConfig } from "@repo/auth/server";
import { prisma } from "@repo/db";
import { createTransport } from "@repo/transactional/transport";
import { nextCookies } from "better-auth/next-js";

import { getEnv } from "./env";

const createGetAuth = <AuthResult>(
  create: (options: AuthConfig) => AuthResult,
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
      mailer: {
        from: env.FROM_EMAIL,
        transport: createTransport({ apiKey: env.RESEND_API_KEY, transport: env.MAIL_TRANSPORT }),
      },
      prisma,
      secret: env.BETTER_AUTH_SECRET,
      signupMode: env.SIGNUP_MODE,
    });

    return cachedAuth;
  };
};

const getAuth: () => Auth = createGetAuth(createAuth);

export { createGetAuth, getAuth };
