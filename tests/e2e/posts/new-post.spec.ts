import { expect, test } from "@playwright/test";
import { prisma } from "@repo/db";

import { recordCleanup } from "../helpers/cleanup-record";

test("a new post shows its errors on submit, focuses the first one, and saves once fixed", async ({
  page,
}) => {
  const domain = recordCleanup("site", `e2e-post-${crypto.randomUUID()}.example`);
  await prisma.site.create({ data: { domain } });

  const slugError = page.getByText(
    "Use lowercase letters and numbers, separated by single hyphens.",
  );

  const slug = page.getByLabel("Slug", { exact: true });
  const save = page.getByRole("button", { exact: true, name: "Save" });

  await page.goto("/dashboard/posts/new");
  await page.getByRole("combobox", { exact: true, name: "Site" }).click();
  await page.getByRole("option", { exact: true, name: domain }).click();
  await slug.fill("Not Kebab");
  await expect(slugError).toBeHidden();

  await save.click();
  await expect(slugError).toBeVisible();
  await expect(page.getByText("Enter a title.")).toBeVisible();
  await expect(slug).toBeFocused();
  await expect(save).toBeEnabled();

  await slug.fill("validation-post");
  await expect(slugError).toBeHidden();
  await page.getByLabel("Title", { exact: true }).fill("A validated post");
  await page.getByLabel("Body (Markdown)").fill("## Validated\n\nThis post passed the form.");
  await save.click();

  await page.waitForURL(/\/dashboard\/posts\/[^/]+$/u);
  await expect(page.getByRole("heading", { name: "A validated post" })).toBeVisible();
});
