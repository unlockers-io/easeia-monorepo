import { mkdir } from "node:fs/promises";

import { expect, test as setup } from "@playwright/test";

import { webUrl } from "../../../playwright.config";
import { recordCleanup } from "../helpers/cleanup-record";

const TEST_USER = {
  email: "e2e-test@easeia.localhost",
  name: "E2E Test User",
  password: "TestPassword123!",
};

setup("create and authenticate test user", async ({ page, request }) => {
  await mkdir("tests/e2e/.auth", { recursive: true });

  recordCleanup("user", TEST_USER.email);
  const signUpResponse = await request.post(`${webUrl}/api/auth/sign-up/email`, {
    data: {
      email: TEST_USER.email,
      name: TEST_USER.name,
      password: TEST_USER.password,
    },
  });
  expect([200, 201, 409, 422]).toContain(signUpResponse.status());

  await page.goto("/login");
  await page.getByLabel("Email").fill(TEST_USER.email);
  await page.getByLabel("Password").fill(TEST_USER.password);
  await page.getByRole("button", { name: "Sign in" }).click();

  await page.waitForURL("/dashboard");
  await expect(page.getByRole("heading", { name: "Network report" })).toBeVisible();

  await page.context().storageState({ path: "tests/e2e/.auth/user.json" });
});
