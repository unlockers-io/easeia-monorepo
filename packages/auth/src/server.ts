import type { PrismaClient } from "@repo/db";
import { slug } from "@repo/identity";
import { log } from "@repo/observability";
import { loopbackUrl } from "@repo/portless-env/apps";
import type { MailerConfig } from "@repo/transactional";
import { sendTransactionalEmail } from "@repo/transactional";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { bearer } from "better-auth/plugins/bearer";
import { username } from "better-auth/plugins/username";
import type { BetterAuthOptions, BetterAuthPlugin } from "better-auth/types";

import { PASSWORD_LENGTH } from "./policy";
import { createSignupGuard, DEFAULT_SIGNUP_MODE, type SignupMode } from "./signup";

const HOUR_SECONDS = 60 * 60;
const VERIFICATION_LINK_HOURS = 24;
const RESET_LINK_HOURS = 1;

type SessionConfig = {
  allowedHosts: Array<string>;
  extraPlugins?: Array<BetterAuthPlugin>;
  prisma: PrismaClient;
  rateLimitEnabled?: boolean;
  secret: string;
  trustedOrigins?: Array<string>;
  useSecureCookies?: boolean;
};

type AuthConfig = SessionConfig & {
  mailer: MailerConfig;
  signupMode?: SignupMode;
};

const sessionOptions = (
  {
    allowedHosts,
    extraPlugins = [],
    rateLimitEnabled = false,
    secret,
    trustedOrigins = [],
    useSecureCookies = false,
  }: Omit<SessionConfig, "prisma">,
  database: Parameters<typeof prismaAdapter>[0],
) =>
  ({
    advanced: {
      cookiePrefix: slug,
      defaultCookieAttributes: {
        httpOnly: true,
        sameSite: "lax" as const,
      },
      useSecureCookies,
    },

    basePath: "/api/auth",

    // Dynamic base URL: Better Auth derives the canonical origin from the
    // incoming request when its host matches `allowedHosts`. `allowedHosts`
    // also auto-extends `trustedOrigins`. See:
    // https://better-auth.com/docs/reference/options#dynamic-base-url
    baseURL: {
      allowedHosts,
      fallback: loopbackUrl("api", "localhost"),
      protocol: "auto",
    },

    database: prismaAdapter(database, {
      provider: "postgresql",
    }),

    plugins: [username(), bearer(), ...extraPlugins],

    rateLimit: {
      enabled: rateLimitEnabled,
      max: 100,
      storage: "database",
      window: 60,
    },

    secret,

    session: {
      cookieCache: {
        enabled: true,
        maxAge: 5 * 60,
      },
      expiresIn: 60 * 60 * 24 * 7,
      storeSessionInDatabase: true,
      updateAge: 60 * 60 * 24,
    },
    trustedOrigins,
    user: {
      additionalFields: {
        displayName: {
          defaultValue: null,
          required: false,
          type: "string",
        },
      },
    },
  }) satisfies BetterAuthOptions;

export const createSessionReader = ({ prisma, ...config }: SessionConfig) => {
  const auth = betterAuth(sessionOptions(config, prisma));

  return { getSession: auth.api.getSession };
};

export const createAuth = ({
  mailer,
  prisma,
  signupMode = DEFAULT_SIGNUP_MODE,
  ...config
}: AuthConfig) => {
  // Keep the count and insert under one database lock across web replicas.
  const guardedPrisma =
    signupMode === "open"
      ? prisma
      : prisma.$extends({
          query: {
            user: {
              create: ({ args }) =>
                prisma.$transaction(async (tx) => {
                  await tx.$executeRaw`SELECT pg_advisory_xact_lock(1701199301)`;
                  await createSignupGuard(signupMode, () => tx.user.count())();

                  return tx.user.create(args);
                }),
            },
          },
        });

  const session = sessionOptions(config, guardedPrisma);

  return betterAuth({
    ...session,

    account: {
      accountLinking: {
        enabled: true,
        trustedProviders: ["email"],
      },
    },

    emailAndPassword: {
      disableSignUp: signupMode === "closed",
      enabled: true,
      maxPasswordLength: PASSWORD_LENGTH.max,
      minPasswordLength: PASSWORD_LENGTH.min,
      onExistingUserSignUp: async ({ user }, request) => {
        const origin = request?.headers.get("origin") ?? "";

        // Swallowed on purpose: surfacing this failure to the client would
        // reveal whether the address already has an account. Now that
        // sendEmail rejects, the catch is what keeps that property.
        try {
          await sendTransactionalEmail(
            {
              resetPasswordUrl: `${origin}/recover`,
              signInUrl: `${origin}/login`,
              type: "sign-up-attempt",
              userEmail: user.email,
              userId: user.id,
              username: user.name,
            },
            mailer,
          );
        } catch (error) {
          log.error({ err: error, message: "failed to send sign-up attempt email" });
        }
      },
      requireEmailVerification: true,
      resetPasswordTokenExpiresIn: RESET_LINK_HOURS * HOUR_SECONDS,
      sendResetPassword: async ({ url, user }) => {
        await sendTransactionalEmail(
          {
            expiresInHours: RESET_LINK_HOURS,
            resetUrl: url,
            type: "password-reset",
            userEmail: user.email,
            userId: user.id,
            username: user.name,
          },
          mailer,
        );
      },
    },

    emailVerification: {
      autoSignInAfterVerification: true,
      callbackURL: "/",
      expiresIn: VERIFICATION_LINK_HOURS * HOUR_SECONDS,
      sendOnSignIn: true,
      sendVerificationEmail: async ({ url, user }) => {
        await sendTransactionalEmail(
          {
            expiresInHours: VERIFICATION_LINK_HOURS,
            type: "welcome",
            userEmail: user.email,
            userId: user.id,
            username: user.name,
            verificationUrl: url,
          },
          mailer,
        );
      },
    },

    user: {
      ...session.user,
      changeEmail: {
        enabled: true,
        sendChangeEmailConfirmation: async ({ newEmail, url, user }) => {
          await sendTransactionalEmail(
            {
              changeUrl: url,
              currentEmail: user.email,
              expiresInHours: VERIFICATION_LINK_HOURS,
              newEmail,
              type: "change-email-confirmation",
              userId: user.id,
              username: user.name,
            },
            mailer,
          );
        },
      },
    },
  });
};

export type Auth = ReturnType<typeof createAuth>;

export type { AuthConfig };
