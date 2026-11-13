"use client";

import { GlobalErrorContent } from "@repo/ui/compositions/global-error";
import type { BoundaryError, ErrorBoundaryProps } from "@repo/ui/hooks/use-error-report";
import { globalErrorClassNames } from "@repo/ui/lib/global-error-class-names";

import { log } from "@/lib/observability-client";

const report = (error: BoundaryError) => {
  log.error({ digest: error.digest, error: error.message, message: "Global error boundary" });
};

const GlobalError = ({ error, retry }: ErrorBoundaryProps) => (
  <html className={globalErrorClassNames.html} lang="en-US">
    <body className={globalErrorClassNames.body}>
      <GlobalErrorContent error={error} report={report} retry={retry} />
    </body>
  </html>
);

export default GlobalError;
