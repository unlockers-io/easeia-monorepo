"use client";

import { Button } from "@repo/ui/components/button";
import { useId, useRef, useState, useTransition } from "react";

import { startGscBacklinkBackfillAction, uploadExternalBacklinksAction } from "./actions";

type CsvFeedback =
  | { kind: "idle" }
  | { imported: number; kind: "success"; skipped: number }
  | { kind: "error"; message: string };

type ApiFeedback = { kind: "idle" } | { kind: "queued" } | { kind: "error"; message: string };

export const ExternalBacklinksUpload = ({
  hasGoogleConnection,
  siteId,
}: {
  hasGoogleConnection: boolean;
  siteId: string;
}) => {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [csvFeedback, setCsvFeedback] = useState<CsvFeedback>({ kind: "idle" });
  const [apiFeedback, setApiFeedback] = useState<ApiFeedback>({ kind: "idle" });
  const [isCsvPending, startCsvTransition] = useTransition();
  const [isApiPending, startApiTransition] = useTransition();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setCsvFeedback({ kind: "idle" });
    setFile(event.target.files?.[0] ?? null);
  };

  const handleCsvSubmit = (event: React.SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!file) {
      setCsvFeedback({ kind: "error", message: "Choose a CSV file first." });
      return;
    }
    startCsvTransition(async () => {
      try {
        const text = await file.text();
        const result = await uploadExternalBacklinksAction(siteId, text);
        setCsvFeedback({ kind: "success", ...result });
        setFile(null);
        if (inputRef.current) {
          inputRef.current.value = "";
        }
      } catch (error) {
        setCsvFeedback({
          kind: "error",
          message: error instanceof Error ? error.message : "Upload failed.",
        });
      }
    });
  };

  const handleApiStart = () => {
    setApiFeedback({ kind: "idle" });
    startApiTransition(async () => {
      try {
        const result = await startGscBacklinkBackfillAction(siteId);
        if (result.ok) {
          setApiFeedback({ kind: "queued" });
        } else {
          setApiFeedback({ kind: "error", message: result.error });
        }
      } catch (error) {
        setApiFeedback({
          kind: "error",
          message: error instanceof Error ? error.message : "Failed to start import.",
        });
      }
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <form className="flex flex-col gap-2" onSubmit={handleCsvSubmit}>
        <label className="text-xs font-medium text-muted-foreground" htmlFor={inputId}>
          Import GSC backlinks (CSV)
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <input
            accept=".csv,text/csv"
            aria-describedby={`${inputId}-help`}
            className="block w-full max-w-xs text-xs file:mr-3 file:rounded-md file:border file:border-input file:bg-background file:px-2 file:py-1 file:text-xs file:font-medium hover:file:bg-accent"
            disabled={isCsvPending}
            id={inputId}
            onChange={handleFileChange}
            ref={inputRef}
            type="file"
          />
          <Button disabled={!file || isCsvPending} size="sm" type="submit" variant="outline">
            {isCsvPending ? "Importing…" : "Import"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground" id={`${inputId}-help`}>
          Export from Search Console → Links → Top linking sites → Export → Download CSV.
        </p>
        {csvFeedback.kind === "success" && (
          <output className="text-xs text-primary">
            Imported {csvFeedback.imported.toLocaleString()} referring{" "}
            {csvFeedback.imported === 1 ? "domain" : "domains"}
            {csvFeedback.skipped > 0
              ? `, skipped ${csvFeedback.skipped.toLocaleString()} row(s)`
              : ""}
            .
          </output>
        )}
        {csvFeedback.kind === "error" && (
          <p className="text-xs text-destructive" role="alert">
            {csvFeedback.message}
          </p>
        )}
      </form>

      <div className="flex flex-col gap-2 border-t pt-4">
        <p className="text-xs font-medium text-muted-foreground">
          Auto-import from Search Console (URL Inspection)
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            disabled={!hasGoogleConnection || isApiPending}
            onClick={handleApiStart}
            size="sm"
            type="button"
            variant="outline"
          >
            {isApiPending ? "Starting…" : "Auto-import from Search Console"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {hasGoogleConnection
            ? "Drips URL Inspection calls under the daily quota (~500/day). A full site takes a few days."
            : "Connect Google in Settings to enable automatic imports."}
        </p>
        {apiFeedback.kind === "queued" && (
          <output className="text-xs text-primary">
            Backfill queued. Referring URLs will populate as the worker processes posts.
          </output>
        )}
        {apiFeedback.kind === "error" && (
          <p className="text-xs text-destructive" role="alert">
            {apiFeedback.message}
          </p>
        )}
      </div>
    </div>
  );
};
