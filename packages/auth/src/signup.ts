import { APIError } from "better-auth/api";

export const SIGNUP_MODES = ["open", "first-user", "closed"] as const;

export type SignupMode = (typeof SIGNUP_MODES)[number];

export const DEFAULT_SIGNUP_MODE: SignupMode = "first-user";

export const isSignupOpen = (mode: SignupMode, userCount: number): boolean =>
  mode === "open" || (mode === "first-user" && userCount === 0);

export const createSignupGuard =
  (mode: SignupMode, countUsers: () => Promise<number>) => async (): Promise<void> => {
    if (mode === "open") {
      return;
    }

    if (mode === "closed" || !isSignupOpen(mode, await countUsers())) {
      throw new APIError("FORBIDDEN", {
        message:
          mode === "closed"
            ? "Sign-ups are closed on this instance."
            : "This instance already has an administrator.",
      });
    }
  };
