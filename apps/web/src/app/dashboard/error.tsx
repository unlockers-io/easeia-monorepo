"use client";

import { RouteError } from "@repo/ui/compositions/route-error";
import type { ErrorBoundaryProps } from "@repo/ui/hooks/use-error-report";

import { log } from "@/lib/observability-client";

const AppRouteError = ({ error, retry }: ErrorBoundaryProps) => (
  <RouteError
    className="min-h-96"
    error={error}
    log={log}
    message="Dashboard error boundary"
    retry={retry}
  />
);

export default AppRouteError;
