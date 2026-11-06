import { useEffect, useRef } from "react";

type BoundaryError = Error & { digest?: string };

type ErrorReport = { digest: string | undefined; error: string; message: string };

type ErrorLog = { error: (report: ErrorReport) => void };

type ErrorBoundaryProps = {
  error: BoundaryError;
  retry: () => void;
};

const useErrorReport = (error: BoundaryError, log: ErrorLog, message: string) => {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    log.error({ digest: error.digest, error: error.message, message });
    headingRef.current?.focus();
  }, [error, log, message]);

  return headingRef;
};

export { useErrorReport };

export type { ErrorBoundaryProps, ErrorLog, ErrorReport };
