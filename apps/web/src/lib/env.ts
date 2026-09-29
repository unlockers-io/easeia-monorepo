import { senderAddressSchema } from "@repo/transactional";
import { z } from "zod";

const envSchema = z
  .object({
    BETTER_AUTH_SECRET: z
      .string()
      .min(32, "BETTER_AUTH_SECRET must be at least 32 characters (openssl rand -base64 32)"),
    FROM_EMAIL: z.preprocess(
      (value) => (value === "" ? undefined : value),
      senderAddressSchema.optional(),
    ),
    REDIS_URL: z.string().min(1),
    RESEND_API_KEY: z.preprocess(
      (value) => (value === "" ? undefined : value),
      z.string().optional(),
    ),
    SIGNUP_MODE: z.enum(["open", "first-user", "closed"]).default("first-user"),
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

type Env = z.infer<typeof envSchema>;

let cachedEnv: Env | undefined;

const parseEnv = (input: NodeJS.ProcessEnv): Env => {
  const parsedEnv = envSchema.safeParse(
    Object.fromEntries(Object.entries(input).filter(([, value]) => value !== "")),
  );

  if (!parsedEnv.success) {
    throw new Error(
      `Invalid environment variables:\n${JSON.stringify(z.treeifyError(parsedEnv.error), null, 2)}`,
    );
  }

  return parsedEnv.data;
};

const getEnv = (): Env => {
  if (cachedEnv !== undefined) {
    return cachedEnv;
  }
  const env = parseEnv(process.env);
  cachedEnv = env;
  return env;
};

const redisUrl = (): string => getEnv().REDIS_URL;

export { getEnv, parseEnv, redisUrl };
