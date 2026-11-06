import { createObservability } from "@repo/observability/next";

export const { log, onRequestError, register } = createObservability({ service: "web" });
