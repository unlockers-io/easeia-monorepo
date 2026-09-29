"use client";

import { createBetterAuthClient } from "@repo/auth/client";
import { usernameClient } from "better-auth/client/plugins";

const authClient = createBetterAuthClient({
  baseURL: typeof window === "undefined" ? "" : `${window.location.origin}/api/auth`,
  plugins: [usernameClient()],
});

const authFailureMessage = (cause: unknown): string =>
  cause instanceof Error ? cause.message : "An error occurred. Please try again.";

export { authClient, authFailureMessage };
