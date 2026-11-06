import type { Locator, Page } from "@playwright/test";

export const formAlert = (page: Page): Locator => page.locator('[data-slot="form-alert"]');
