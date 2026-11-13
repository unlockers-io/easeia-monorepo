"use client";

import { RouteError } from "@repo/ui/compositions/route-error";
import type { BoundaryError, ErrorBoundaryProps } from "@repo/ui/hooks/use-error-report";

import { log } from "@/lib/observability-client";

const report = (error: BoundaryError) => {
  log.error({ digest: error.digest, error: error.message, message: "Dashboard error boundary" });
};

const AppRouteError = ({ error, retry }: ErrorBoundaryProps) => (
  <RouteError className="min-h-96" error={error} report={report} retry={retry} />
);

export default AppRouteError;
