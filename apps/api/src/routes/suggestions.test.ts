import { describe, expect, it, vi } from "vitest";

import { createSuggestionRoutes } from "./suggestions";
import { mountForTest, openGuards } from "./test-harness";

const decided = { anchorText: "new anchor", approved: null, id: "l1" };
const editAnchorMock = vi.fn(() => Promise.resolve(decided));

const suggestionRoutes = createSuggestionRoutes({
  ...openGuards,
  approveSuggestion: () => Promise.resolve(decided),
  editSuggestionAnchor: editAnchorMock,
  listSuggestions: () => Promise.resolve({ data: [], nextCursor: undefined }),
  rejectSuggestion: () => Promise.resolve(decided),
});

const app = mountForTest(suggestionRoutes);

type AnchorRequestBody = { anchorText: number | string };

const patch = (path: string, body?: AnchorRequestBody) =>
  app.request(path, {
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
    method: "PATCH",
  });

describe("PATCH /:id/anchor: validation error envelope", () => {
  it("returns the standard error envelope on an invalid body", async () => {
    const res = await patch("/l1/anchor", { anchorText: 123 });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: {
        code: "VALIDATION_ERROR",
        details: expect.any(Array),
        message: "Validation failed",
      },
    });
  });

  it("updates the anchor on a valid body", async () => {
    const res = await patch("/l1/anchor", { anchorText: "new anchor" });
    expect(res.status).toBe(200);
    expect(editAnchorMock).toHaveBeenCalledWith("l1", "new anchor");
  });
});

it("requires an anchor instead of accepting an unimplemented regenerate request", async () => {
  const res = await app.request("/l1/anchor", {
    body: JSON.stringify({ regenerate: true }),
    headers: { "Content-Type": "application/json" },
    method: "PATCH",
  });

  expect(res.status).toBe(400);
});
