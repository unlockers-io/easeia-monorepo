import { signJWT } from "better-auth/crypto";

import { webUrl } from "../urls";

const requireSecret = (): string => {
  const secret = process.env.BETTER_AUTH_SECRET;

  if (!secret) {
    throw new Error(
      "BETTER_AUTH_SECRET is required for verification.fixture (it signs the same JWT Better Auth would).",
    );
  }

  return secret;
};

const forVerifyEmail = async (email: string): Promise<{ token: string; url: string }> => {
  const token = await signJWT({ email: email.toLowerCase() }, requireSecret(), 3600);
  const callbackURL = encodeURIComponent("/");
  const url = `${webUrl}/api/auth/verify-email?token=${token}&callbackURL=${callbackURL}`;

  return { token, url };
};

const verification = {
  forVerifyEmail,
};

export { verification };
