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
import type { BetterAuthPlugin } from "better-auth/types";

import { isMailConfigured } from "./env";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "./limits";
import { createSignupGuard, DEFAULT_SIGNUP_MODE, type SignupMode } from "./signup";

const HOUR_SECONDS = 60 * 60;
const VERIFICATION_LINK_HOURS = 24;
const RESET_LINK_HOURS = 1;

type AuthConfig = {
  allowedHosts: Array<string>;
  extraPlugins?: Array<BetterAuthPlugin>;
  fromEmail?: string;
  prisma: PrismaClient;
  rateLimitEnabled?: boolean;
  resendApiKey?: string;
  secret: string;
  signupMode?: SignupMode;
  trustedOrigins?: Array<string>;
  useSecureCookies?: boolean;
};

export const createAuth = (config: AuthConfig) => {
  const {
    allowedHosts,
    extraPlugins = [],
    fromEmail,
    prisma,
    rateLimitEnabled = false,
    resendApiKey,
    secret,
    signupMode = DEFAULT_SIGNUP_MODE,
    trustedOrigins = [],
    useSecureCookies = false,
  } = config;

  const mailEnv = { FROM_EMAIL: fromEmail, RESEND_API_KEY: resendApiKey };

  const mailer: MailerConfig | null = isMailConfigured(mailEnv)
    ? { apiKey: mailEnv.RESEND_API_KEY, from: mailEnv.FROM_EMAIL }
    : null;

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

  return betterAuth({
    account: {
      accountLinking: {
        enabled: true,
        trustedProviders: ["email"],
      },
    },

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

    database: prismaAdapter(guardedPrisma, {
      provider: "postgresql",
    }),

    emailAndPassword: {
      disableSignUp: signupMode === "closed",
      enabled: true,
      maxPasswordLength: PASSWORD_MAX_LENGTH,
      minPasswordLength: PASSWORD_MIN_LENGTH,
      onExistingUserSignUp: mailer
        ? async ({ user }, request) => {
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
          }
        : undefined,
      requireEmailVerification: Boolean(mailer),
      resetPasswordTokenExpiresIn: RESET_LINK_HOURS * HOUR_SECONDS,
      sendResetPassword: mailer
        ? async ({ url, user }) => {
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
          }
        : undefined,
    },

    emailVerification: {
      autoSignInAfterVerification: true,
      callbackURL: "/",
      expiresIn: VERIFICATION_LINK_HOURS * HOUR_SECONDS,
      sendOnSignIn: true,
      sendVerificationEmail: mailer
        ? async ({ url, user }) => {
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
          }
        : undefined,
    },

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
      changeEmail: {
        enabled: true,
        sendChangeEmailConfirmation: mailer
          ? async ({ newEmail, url, user }) => {
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
            }
          : undefined,
      },
    },
  });
};

export type Auth = ReturnType<typeof createAuth>;

export type { AuthConfig };
