import { createAuth } from "@repo/auth/server";
import { prisma } from "@repo/db";

const SEED_FROM_EMAIL = "Easeia <noreply@email.easeia.com>";

const seedValue = (name: string, developmentDefault: string): string => {
  const value = process.env[name];
  if (value !== undefined && value.trim() !== "") {
    return value;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error(`${name} must be set to seed the admin user in production.`);
  }
  return developmentDefault;
};

const requireSecret = (): string => {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (secret === undefined || secret.length < 32) {
    throw new Error("BETTER_AUTH_SECRET must be set (32+ chars) to seed the admin user.");
  }
  return secret;
};

type SeedAdminInput = { email: string; name: string; password: string; secret: string };

type SeedAdminDeps = {
  findUser: (email: string) => Promise<{ id: string } | null>;
  signUp: (input: SeedAdminInput) => Promise<void>;
};

export const createSeedAdmin = (deps: SeedAdminDeps) => async (): Promise<void> => {
  const email = seedValue("SEED_ADMIN_EMAIL", "test@easeia.dev").trim().toLowerCase();
  const password = seedValue("SEED_ADMIN_PASSWORD", "test-password-1234");
  const name = seedValue("SEED_ADMIN_NAME", "Test Admin").trim();
  if (password.length < 12 || password.length > 128) {
    throw new Error("SEED_ADMIN_PASSWORD must be between 12 and 128 characters.");
  }
  const secret = requireSecret();

  const existing = await deps.findUser(email);
  if (existing) {
    console.log(`admin ${email} already exists; skipping`);
    return;
  }

  await deps.signUp({ email, name, password, secret });

  console.log(`seeded admin ${email}`);
};

export const seedAdmin = createSeedAdmin({
  findUser: (email) => prisma.user.findUnique({ select: { id: true }, where: { email } }),
  signUp: async ({ secret, ...body }) => {
    const auth = createAuth({
      allowedHosts: ["localhost:*"],
      fromEmail: SEED_FROM_EMAIL,
      prisma,
      secret,
    });
    await auth.api.signUpEmail({ body });
  },
});
