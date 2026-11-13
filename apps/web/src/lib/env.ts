import { authEnvSchema, parseEnv } from "@repo/auth/env";
import { authEnv } from "@repo/auth/env-config";
import type { z } from "zod";

let cachedEnv: z.output<typeof authEnvSchema> | undefined;

export const getEnv = () => (cachedEnv ??= parseEnv(authEnvSchema));

// The root layout reads this at build, where the secrets the schema requires are absent.
export const webAppUrl = () => authEnv.shape.WEB_APP_URL.parse(process.env.WEB_APP_URL);
