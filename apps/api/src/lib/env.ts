import { authSecretSchema, parseEnv } from "@repo/auth/env";
import { authEnv } from "@repo/auth/env-config";
import { apps } from "@repo/portless-env/apps";
import { z } from "zod";

export const envSchema = z.object({
  ...authEnv.shape,
  BETTER_AUTH_SECRET: authSecretSchema,
  DATABASE_URL: z.string().min(1),
  HOST: z.string().default("0.0.0.0"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().default(apps.api.port),
});

export const env = parseEnv(envSchema);
