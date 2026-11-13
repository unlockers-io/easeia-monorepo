"use client";

import { useErrorReport } from "../hooks/use-error-report";
import type { ErrorBoundaryProps, ReportError } from "../hooks/use-error-report";

import styles from "./global-error.module.css";

type GlobalErrorContentProps = ErrorBoundaryProps & { report: ReportError };

const GlobalErrorContent = ({ error, report, retry }: GlobalErrorContentProps) => {
  const headingRef = useErrorReport(error, report);

  return (
    <>
      <title>Something went wrong</title>
      <main className={styles.main} id="main-content">
        <h1 className={styles.heading} ref={headingRef} tabIndex={-1}>
          Something went wrong
        </h1>
        <p className={styles.text}>
          The application stopped unexpectedly. Try again, and if the problem continues, reload the
          page or come back in a few minutes.
        </p>
        <button className={styles.button} onClick={retry} type="button">
          Try again
        </button>
        {error.digest !== undefined && <p className={styles.digest}>Reference: {error.digest}</p>}
      </main>
    </>
  );
};

export { GlobalErrorContent };
