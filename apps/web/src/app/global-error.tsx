"use client";

import { globalErrorClassNames, GlobalErrorContent } from "@repo/ui/compositions/global-error";
import type { ErrorBoundaryProps } from "@repo/ui/hooks/use-error-report";

import { log } from "@/lib/observability-client";

const GlobalError = ({ error, retry }: ErrorBoundaryProps) => (
  <html className={globalErrorClassNames.html} lang="en">
    <body className={globalErrorClassNames.body}>
      <GlobalErrorContent error={error} log={log} retry={retry} />
    </body>
  </html>
);

export default GlobalError;
