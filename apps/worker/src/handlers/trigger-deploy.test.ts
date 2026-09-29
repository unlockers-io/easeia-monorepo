import { describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.DATABASE_URL = "postgresql://test:test@localhost:5440/easeia_test";
});

import { createHandleTriggerDeploy, type TriggerDeployDependencies } from "./trigger-deploy";

const createHandler = (
  loadSite: TriggerDeployDependencies["loadSite"],
  fetchHook: TriggerDeployDependencies["fetchHook"],
) =>
  createHandleTriggerDeploy({
    createLogger: () => ({
      emit: vi.fn(() => null),
      info: vi.fn(() => {}),
      set: vi.fn(() => {}),
      warn: vi.fn(() => {}),
    }),
    fetchHook,
    loadSite,
  });

describe("handleTriggerDeploy", () => {
  it("POSTs the site's deploy hook URL when present", async () => {
    const fetchMock = vi.fn(() => Promise.resolve(new Response("ok", { status: 200 })));
    const loadSite = vi.fn(() =>
      Promise.resolve({
        domain: "x.test",
        id: "s",
        vercelDeployHookUrl: "https://vercel.test/hook/abc",
      }),
    );

    const handleTriggerDeploy = createHandler(loadSite, fetchMock);
    await handleTriggerDeploy({
      attemptsMade: 0,
      finalAttempt: false,
      jobId: "j",
      payload: { siteId: "s" },
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://vercel.test/hook/abc",
      expect.objectContaining({ method: "POST", signal: expect.any(AbortSignal) }),
    );
  });

  it("short-circuits (no fetch) when the hook URL is not http(s)", async () => {
    const fetchMock = vi.fn();
    const loadSite = vi.fn(() =>
      Promise.resolve({
        domain: "x.test",
        id: "s",
        vercelDeployHookUrl: "file:///etc/passwd",
      }),
    );
    const handleTriggerDeploy = createHandler(loadSite, fetchMock);
    await handleTriggerDeploy({
      attemptsMade: 0,
      finalAttempt: false,
      jobId: "j",
      payload: { siteId: "s" },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("no-ops (and does not throw) when the site has no deploy hook URL", async () => {
    const fetchMock = vi.fn();
    const loadSite = vi.fn(() =>
      Promise.resolve({ domain: "x.test", id: "s", vercelDeployHookUrl: null }),
    );
    const handleTriggerDeploy = createHandler(loadSite, fetchMock);
    await handleTriggerDeploy({
      attemptsMade: 0,
      finalAttempt: false,
      jobId: "j",
      payload: { siteId: "s" },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("throws on non-2xx so BullMQ retries", async () => {
    const fetchMock = vi.fn(() => Promise.resolve(new Response("nope", { status: 500 })));
    const loadSite = vi.fn(() =>
      Promise.resolve({
        domain: "x.test",
        id: "s",
        vercelDeployHookUrl: "https://vercel.test/hook/abc",
      }),
    );
    const handleTriggerDeploy = createHandler(loadSite, fetchMock);
    await expect(
      handleTriggerDeploy({
        attemptsMade: 0,
        finalAttempt: false,
        jobId: "j",
        payload: { siteId: "s" },
      }),
    ).rejects.toThrow(/500/v);
  });
});
