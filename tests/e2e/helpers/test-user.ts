import { createHash } from "node:crypto";

export const TEST_USER = {
  email: "e2e-test@easeia.localhost",
  name: "E2E Test User",
  password: "TestPassword123!",
};

export const makeTestUsername = (email: string): string => {
  const hash = createHash("sha256").update(email).digest("hex").slice(0, 16);

  return `e2e_${hash}`;
};
