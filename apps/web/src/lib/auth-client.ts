"use client";

import { createBetterAuthClient } from "@repo/auth/client";

const authClient = createBetterAuthClient({
  baseURL: typeof window === "undefined" ? "" : `${window.location.origin}/api/auth`,
});

type AuthResponse =
  | { data: unknown; error: null }
  | { data: null; error: { code?: string; message?: string } };

type AuthResult<R extends AuthResponse> =
  | { data: Extract<R, { error: null }>["data"]; ok: true }
  | { code?: string; error: string; ok: false };

const runAuth = async <R extends AuthResponse>(
  request: Promise<R>,
  fallback: string,
): Promise<AuthResult<R>> => {
  try {
    const response = await request;

    if (response.error === null) {
      return { data: response.data, ok: true };
    }

    return { code: response.error.code, error: response.error.message ?? fallback, ok: false };
  } catch (error) {
    return { error: error instanceof Error ? error.message : fallback, ok: false };
  }
};

export { authClient, runAuth };
