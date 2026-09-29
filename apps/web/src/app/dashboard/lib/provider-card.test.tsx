import { render } from "@testing-library/react";
import { expect, it } from "vitest";

import { IntegrationNotConfiguredCard } from "./provider-card";

it("names missing configuration and links to recovery", () => {
  const view = render(
    <IntegrationNotConfiguredCard
      feature="Live SEO insights"
      missing={["DATAFORSEO_LOGIN", "DATAFORSEO_PASSWORD"]}
      name="DataForSEO"
    />,
  );
  expect(view.getByText(/Set DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD/).textContent).toContain(
    "enable it",
  );
  expect(view.getByRole("link", { name: "View integration settings" }).getAttribute("href")).toBe(
    "/dashboard/settings#integrations",
  );
});
