"use client";

import { Button } from "@repo/ui/components/button";
import { AlertCircle, RefreshCw } from "lucide-react";
import { useEffect, useRef } from "react";

import { log } from "@/lib/observability-client";

/**
 * `retry`, not `reset`: reset re-renders against the same failed RSC payload, so
 * it cannot recover a Server Component error. retry refreshes, then resets.
 */
type RouteErrorProps = {
  error: Error & { digest?: string };
  retry: () => void;
};

const RouteError = ({ error, retry }: RouteErrorProps) => {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    log.error({ digest: error.digest, error: error.message, message: "Dashboard error boundary" });
    headingRef.current?.focus();
  }, [error]);

  return (
    <section className="flex min-h-96 flex-col items-center justify-center gap-6 bg-background px-6 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10">
        <AlertCircle className="size-5 text-destructive" />
      </div>
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-foreground" ref={headingRef} tabIndex={-1}>
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
        <RefreshCw className="size-4" />
        Try again
      </Button>
    </section>
  );
};

export default RouteError;
