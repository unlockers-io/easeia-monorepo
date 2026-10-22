import { createRequestLogger } from "evlog";
import { describe, expect, it, vi } from "vitest";

import { createIdentify, identifyUser } from "./auth";

describe("identifyUser", () => {
  it("puts the resolved session's user on the request's wide event", () => {
    const log = createRequestLogger({ method: "GET", path: "/api/v1/users/me" });

    const identified = identifyUser(log, {
      session: { id: "session-1" },
      user: { email: "alice@example.com", id: "user-1" },
    });

    expect(identified).toBe(true);
    expect(log.getContext()).toMatchObject({
      session: { id: "session-1" },
      user: { email: "alice@example.com", id: "user-1" },
      userId: "user-1",
    });
  });
});

describe("createIdentify", () => {
  it("resolves the request session and enriches its logger", async () => {
    const headers = new Headers({ cookie: "session=test" });

    const session = {
      session: { id: "session-1" },
      user: { email: "alice@example.com", id: "user-1" },
    };

    const getSession = vi.fn().mockResolvedValue(session);
    const log = createRequestLogger({ method: "GET", path: "/api/posts" });

    await createIdentify({ api: { getSession } })(log, headers, "/api/posts");

    expect(getSession).toHaveBeenCalledExactlyOnceWith({ headers });
    expect(log.getContext()).toMatchObject({ ...session, userId: "user-1" });
  });

  it("excludes auth routes from session lookup by default", async () => {
    const getSession = vi.fn().mockResolvedValue(null);
    const log = createRequestLogger({ method: "POST", path: "/api/auth/sign-in" });

    await createIdentify({ api: { getSession } })(log, new Headers(), "/api/auth/sign-in");

    expect(getSession).not.toHaveBeenCalled();
    expect(log.getContext()).not.toHaveProperty("userId");
  });
});
