import { DEFAULT_CORS_ORIGINS } from "@repo/auth/env-config";
import { senderAddressSchema } from "@repo/transactional";
import { z } from "zod";

export const envSchema = z
  .object({
    AUTH_ALLOWED_HOSTS: z.string().optional(),
    BETTER_AUTH_SECRET: z.string().min(32),
    CI: z.string().optional(),
    CORS_ORIGINS: z.string().default(DEFAULT_CORS_ORIGINS.join(",")),
    DATABASE_URL: z.string().min(1),
    FROM_EMAIL: z.preprocess(
      (value) => (value === "" ? undefined : value),
      senderAddressSchema.optional(),
    ),
    HOST: z.string().default("0.0.0.0"),
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    PORT: z.string().default("4000"),
    REDIS_URL: z.string().min(1),
    RESEND_API_KEY: z.preprocess(
      (value) => (value === "" ? undefined : value),
      z.string().optional(),
    ),
    SIGNUP_MODE: z.enum(["open", "first-user", "closed"]).default("first-user"),
    TRUSTED_ORIGINS: z.string().optional(),
    WEB_APP_URL: z.string().optional(),
    WP_ENCRYPTION_KEY: z.string().min(1),
  })
  .superRefine((value, ctx) => {
    if (value.RESEND_API_KEY !== undefined && value.FROM_EMAIL === undefined) {
      ctx.addIssue({
        code: "custom",
        message: "FROM_EMAIL is required when RESEND_API_KEY is set.",
        path: ["FROM_EMAIL"],
      });
    }
  });

const parsedEnv = envSchema.safeParse(
  Object.fromEntries(Object.entries(process.env).filter(([, value]) => value !== "")),
);

if (!parsedEnv.success) {
  throw new Error(
    `Invalid environment variables:\n${JSON.stringify(z.treeifyError(parsedEnv.error), null, 2)}`,
  );
}

export const env = parsedEnv.data;
