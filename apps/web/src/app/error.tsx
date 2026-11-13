"use client";

import { RouteError } from "@repo/ui/compositions/route-error";
import type { BoundaryError, ErrorBoundaryProps } from "@repo/ui/hooks/use-error-report";

import { log } from "@/lib/observability-client";

const report = (error: BoundaryError) => {
  log.error({ digest: error.digest, error: error.message, message: "Route error boundary" });
};

const AppRouteError = ({ error, retry }: ErrorBoundaryProps) => (
  <RouteError as="main" className="min-h-dvh" error={error} report={report} retry={retry} />
);

export default AppRouteError;
