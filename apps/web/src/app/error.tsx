"use client";

import { RouteError } from "@repo/ui/compositions/route-error";
import type { ErrorBoundaryProps } from "@repo/ui/hooks/use-error-report";

import { log } from "@/lib/observability-client";

const AppRouteError = ({ error, retry }: ErrorBoundaryProps) => (
  <RouteError
    as="main"
    className="min-h-dvh"
    error={error}
    log={log}
    message="Route error boundary"
    retry={retry}
  />
);

export default AppRouteError;
