import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RunPanel } from "./run-panel";

const STATUS = {
  active: true,
  counts: {
    classifiedPosts: 4,
    embeddedPosts: 2,
    failed: 0,
    posts: 10,
    skipped: 0,
    suggestDone: 1,
  },
  phase: "CLASSIFY_EMBED",
};

const renderPanel = async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  const view = render(
    <QueryClientProvider client={client}>
      <RunPanel
        description="Backfill"
        loadStatus={() => Promise.resolve({ data: STATUS, ok: true as const })}
        pollMs={60_000}
        queryKey="test-status"
        rows={(counts) => [
          { done: counts.classifiedPosts, label: "Classify (posts)", total: counts.posts },
          { done: counts.embeddedPosts, label: "Embed (posts)", total: counts.posts },
          { done: counts.suggestDone, label: "Suggest links (posts)", total: counts.posts },
        ]}
        runLabel="Run"
        start={() => Promise.resolve({ data: undefined, ok: true as const })}
        title="Network backfill"
      />
    </QueryClientProvider>,
  );

  await view.findByText("Classify (posts)");

  return view;
};

describe("RunPanel", () => {
  it("renders no NaN or undefined for the backfill status shape", async () => {
    const { container } = await renderPanel();
    expect(container.textContent).not.toContain("NaN");
    expect(container.textContent).not.toContain("undefined");
  });

  it("renders one progress row per configured phase", async () => {
    const { container, getByText } = await renderPanel();
    getByText("Classify (posts)");
    getByText("Embed (posts)");
    getByText("Suggest links (posts)");
    expect(container.textContent).toContain("4 / 10");
    expect(container.textContent).toContain("2 / 10");
    expect(container.textContent).toContain("1 / 10");
  });
});
