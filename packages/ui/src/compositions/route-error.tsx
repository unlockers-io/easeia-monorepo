"use client";

import { AlertCircle, RefreshCw } from "lucide-react";

import { Button } from "../components/button";
import { useErrorReport } from "../hooks/use-error-report";
import type { ErrorBoundaryProps, ReportError } from "../hooks/use-error-report";
import { cn } from "../lib/utils";

type RouteErrorProps = ErrorBoundaryProps & {
  as?: "main" | "section";
  className?: string;
  report: ReportError;
};

const RouteError = ({
  as: Container = "section",
  className,
  error,
  report,
  retry,
}: RouteErrorProps) => {
  const headingRef = useErrorReport(error, report);

  return (
    <Container
      className={cn(
        "flex flex-col items-center justify-center gap-6 bg-background px-6 text-center",
        className,
      )}
    >
      <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10">
        <AlertCircle aria-hidden="true" className="size-5 text-destructive" />
      </div>
      <div className="flex flex-col gap-2">
        <h1
          className="text-2xl font-semibold text-foreground outline-none"
          ref={headingRef}
          tabIndex={-1}
        >
          Something went wrong
        </h1>
        <p className="max-w-md text-sm text-muted-foreground">
          An unexpected error occurred. Please try again. If it keeps happening, refresh the page or
          come back in a few minutes.
        </p>
        {error.digest !== undefined && (
          <p className="text-xs text-muted-foreground">Reference: {error.digest}</p>
        )}
      </div>
      <Button onClick={retry}>
        <RefreshCw aria-hidden="true" className="size-4" />
        Try again
      </Button>
    </Container>
  );
};

export { RouteError };
