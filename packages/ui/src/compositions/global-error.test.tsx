import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { ErrorReport } from "../hooks/use-error-report";

import { GlobalErrorContent } from "./global-error";

const error = Object.assign(new Error("Render failed"), { digest: "abc123" });

describe("GlobalErrorContent", () => {
  it("titles the document and shows the reference", () => {
    const markup = renderToStaticMarkup(
      <GlobalErrorContent
        error={error}
        log={{ error: vi.fn<(report: ErrorReport) => void>() }}
        retry={vi.fn<() => void>()}
      />,
    );

    expect(markup).toContain("<title>Something went wrong</title>");
    expect(markup).toContain("Reference: abc123");
  });
});
