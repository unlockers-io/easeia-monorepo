import { z } from "zod";

const envSchema = z.object({
  APP_URL: z.url().optional(),
  BODY_IMAGES_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  DATABASE_URL: z.string().min(1),
  HERO_AUTOGEN_ENABLED: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  OPENAI_API_KEY: z.string().optional(),
  REDIS_URL: z.string().min(1),
  WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(50).default(4),
  WP_ENCRYPTION_KEY: z.string().min(1),
});

const emptyStringAsUndefined = (source: NodeJS.ProcessEnv) =>
  Object.fromEntries(Object.entries(source).filter(([, value]) => value !== ""));

const parsed = envSchema.safeParse(emptyStringAsUndefined(process.env));
if (!parsed.success) {
  throw new Error(
    `Invalid environment variables:\n${JSON.stringify(z.treeifyError(parsed.error), null, 2)}`,
  );
}

export const env = parsed.data;
