import { expect, test } from "@playwright/test";

import { apiUrl } from "../urls";

test.use({ storageState: { cookies: [], origins: [] } });

test.describe("API llms.txt", () => {
  test("documents the operations and the bearer auth", async ({ request }) => {
    const response = await request.get(`${apiUrl}/llms.txt`);

    expect(response.status()).toBe(200);

    const body = await response.text();
    expect(body).toContain("POST /api/posts");
    expect(body).toContain("Authorization: Bearer <token>");
  });
});
