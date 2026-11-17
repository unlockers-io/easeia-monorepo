import { authEnvSchema, parseEnv } from "@repo/auth/env";
import { authEnv } from "@repo/auth/env-config";
import { z } from "zod";

export const envSchema = authEnvSchema.extend({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required: web reads sessions and users from it"),
});

let cachedEnv: z.output<typeof envSchema> | undefined;

export const getEnv = () => (cachedEnv ??= parseEnv(envSchema));

// The root layout reads this at build, where the secrets the schema requires are absent.
export const webAppUrl = () => authEnv.shape.WEB_APP_URL.parse(process.env.WEB_APP_URL);
