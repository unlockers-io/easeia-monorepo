import { test, expect } from "@playwright/test";

import { recordCleanup } from "./helpers/cleanup-record";

// SIGNUP_MODE=open in the isolated E2E instance permits independent runs.
// The first-user race is separately exercised against a fresh self-host stack.
test.use({ storageState: { cookies: [], origins: [] } });

test("registration waits for interactive form handlers before accepting input", async ({
  page,
}) => {
  let releaseScripts: (() => void) | undefined;
  const scriptsReady = new Promise<void>((resolve) => {
    releaseScripts = resolve;
  });
  await page.route("**/_next/static/**/*.js", async (route) => {
    await scriptsReady;
    await route.continue();
  });
  try {
    await page.goto("/register", { waitUntil: "commit" });
    await expect(page.getByLabel("Full Name")).toBeDisabled();
    // Streaming can keep the server-rendered form hidden until scripts resume.
    await expect(
      page.getByRole("button", { includeHidden: true, name: "Create account" }),
    ).toBeDisabled();
  } finally {
    releaseScripts?.();
  }
  await expect(page.getByLabel("Full Name")).toBeEnabled();
  await page.getByLabel("Full Name").fill("Demo Operator");
  await page.getByLabel("Email", { exact: true }).fill("demo@example.com");
  await expect(page.getByLabel("Full Name")).toHaveValue("Demo Operator");
});

test("register, add a site, save a draft, then configure publishing", async ({ page }) => {
  const email = recordCleanup("user", `e2e-first-${crypto.randomUUID()}@easeia.localhost`);
  const domain = recordCleanup("site", `e2e-${crypto.randomUUID()}.example`);
  await page.goto("/register");
  await page.getByLabel("Full Name").fill("Demo Operator");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill("DemoPassword123!");
  await page.getByLabel("Confirm Password").fill("DemoPassword123!");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL("/dashboard");
  await page.goto("/dashboard/sites");
  await page.getByRole("button", { name: "Add site" }).first().click();
  await page.getByLabel("Domain", { exact: true }).fill(domain);
  await page.getByLabel("Content language").selectOption("EN");
  await page.getByRole("button", { exact: true, name: "Create site" }).click();
  await page.waitForURL(/\/dashboard\/sites\/[^/]+$/u);
  await expect(page.getByText("No deploy hook: publishing is blocked")).toBeVisible();
  await page.goto("/dashboard/posts/new");
  await page.getByRole("combobox", { exact: true, name: "Site" }).click();
  await page.getByRole("option", { exact: true, name: domain }).click();
  await page.getByLabel("Slug", { exact: true }).fill("first-draft");
  await page.getByLabel("Title", { exact: true }).fill("A first post for the network");
  await page
    .getByLabel("Body (Markdown)")
    .fill("## A first draft\n\nThis manually written post is ready for review.");
  await page.getByRole("button", { exact: true, name: "Save" }).click();
  await page.waitForURL(/\/dashboard\/posts\/[^/]+$/u);
  await expect(page.getByRole("heading", { name: "A first post for the network" })).toBeVisible();
  const postUrl = page.url();
  await expect(page.getByRole("button", { exact: true, name: "Publish" })).toBeDisabled();
  await page.getByRole("link", { name: `Configure publishing for ${domain}` }).click();
  await page
    .getByLabel("Deploy hook URL", { exact: true })
    .fill("https://deploy.example/first-run");
  await page.getByRole("button", { name: "Save publishing settings" }).click();
  await expect(page.getByText("Publishing settings saved.")).toBeVisible();
  await page.goto(postUrl);
  await expect(page.getByRole("button", { exact: true, name: "Publish" })).toBeEnabled();
  await expect(page.getByText("DataForSEO is not configured")).toBeVisible();
});
