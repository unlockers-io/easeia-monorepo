import { senderAddressSchema } from "@repo/transactional";
import { z } from "zod";

import { DEFAULT_SIGNUP_MODE, SIGNUP_MODES } from "./signup";

export const MAIL_ENV_VARS = ["RESEND_API_KEY", "FROM_EMAIL"] as const;

type MailEnv = Partial<Record<(typeof MAIL_ENV_VARS)[number], string>>;

export const isMailConfigured = (env: MailEnv): env is Required<MailEnv> =>
  MAIL_ENV_VARS.every((name) => (env[name]?.trim() ?? "") !== "");

export const authSecretSchema = z
  .string()
  .min(32, "BETTER_AUTH_SECRET must be at least 32 characters (openssl rand -base64 32)");

export const authEnvSchema = z
  .object({
    BETTER_AUTH_SECRET: authSecretSchema,
    FROM_EMAIL: senderAddressSchema.optional(),
    RESEND_API_KEY: z.string().optional(),
    SIGNUP_MODE: z.enum(SIGNUP_MODES).default(DEFAULT_SIGNUP_MODE),
  })
  .refine((env) => env.RESEND_API_KEY === undefined || env.FROM_EMAIL !== undefined, {
    message: "FROM_EMAIL is required when RESEND_API_KEY is set.",
    path: ["FROM_EMAIL"],
  });

export const parseEnv = <Schema extends z.ZodType>(
  schema: Schema,
  source: NodeJS.ProcessEnv = process.env,
): z.output<Schema> => {
  const parsed = schema.safeParse(
    Object.fromEntries(Object.entries(source).filter(([, value]) => value !== "")),
  );

  if (!parsed.success) {
    throw new Error(
      `Invalid environment variables:\n${JSON.stringify(z.treeifyError(parsed.error), null, 2)}`,
    );
  }

  return parsed.data;
};
