import { authEnvSchema, parseEnv } from "@repo/auth/env";
import type { z } from "zod";

let cachedEnv: z.output<typeof authEnvSchema> | undefined;

export const getEnv = () => (cachedEnv ??= parseEnv(authEnvSchema));
