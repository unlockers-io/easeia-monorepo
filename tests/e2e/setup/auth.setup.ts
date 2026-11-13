import { mkdir } from "node:fs/promises";

import { expect, test as setup } from "@playwright/test";
import { prisma } from "@repo/db";

import { verificationLink } from "../fixtures/verification.fixture";
import { recordCleanup } from "../helpers/cleanup-record";
import { TEST_USER } from "../helpers/test-user";
import { webUrl } from "../urls";

setup("create and authenticate test user", async ({ page, request }) => {
  await mkdir("tests/e2e/.auth", { recursive: true });

  recordCleanup("user", TEST_USER.email);

  const signedUpAt = Date.now();

  const signUpResponse = await request.post(`${webUrl}/api/auth/sign-up/email`, {
    data: {
      email: TEST_USER.email,
      name: TEST_USER.name,
      password: TEST_USER.password,
    },
  });

  expect([200, 201]).toContain(signUpResponse.status());

  const user = await prisma.user.findUniqueOrThrow({
    select: { emailVerified: true },
    where: { email: TEST_USER.email },
  });

  if (!user.emailVerified) {
    const verified = await request.get(
      await verificationLink({ sinceMs: signedUpAt, subject: /verify/i, to: TEST_USER.email }),
    );

    expect(verified.ok()).toBe(true);
  }

  await page.goto("/login");
  await page.getByLabel("Email").fill(TEST_USER.email);
  await page.getByLabel("Password").fill(TEST_USER.password);
  await page.getByRole("button", { name: "Sign in" }).click();

  await page.waitForURL("/dashboard");
  await expect(page.getByRole("heading", { name: "Network report" })).toBeVisible();

  await page.context().storageState({ path: "tests/e2e/.auth/user.json" });
});
