import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { NetworkBackfillPage } from "./status-view";

const API_STATUS = {
  active: true,
  counts: {
    classifiedPosts: 4,
    embeddedPosts: 2,
    failed: 0,
    posts: 10,
    sites: 3,
    suggestDone: 1,
  },
  phase: "CLASSIFY_EMBED",
  startedAt: "2026-07-01T00:00:00.000Z",
};

const renderPage = async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <QueryClientProvider client={client}>
      <NetworkBackfillPage
        loadStatus={() => Promise.resolve(API_STATUS)}
        start={() => Promise.resolve()}
      />
    </QueryClientProvider>,
  );
  await view.findByText("Classify (posts)");
  return view;
};

describe("NetworkBackfillPage", () => {
  it("renders no NaN or undefined for the API's actual status shape", async () => {
    const { container } = await renderPage();
    expect(container.textContent).not.toContain("NaN");
    expect(container.textContent).not.toContain("undefined");
  });

  it("renders one progress row per phase the API reports on", async () => {
    const { container, getByText } = await renderPage();
    getByText("Classify (posts)");
    getByText("Embed (posts)");
    getByText("Suggest links (posts)");
    expect(container.textContent).toContain("4 / 10");
    expect(container.textContent).toContain("2 / 10");
    expect(container.textContent).toContain("1 / 10");
  });
});
