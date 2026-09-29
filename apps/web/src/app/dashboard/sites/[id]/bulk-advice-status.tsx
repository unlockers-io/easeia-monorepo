type BulkState =
  | { kind: "idle" }
  | { kind: "running"; total: number }
  | { failedCount: number; kind: "done"; readyChecks: ReadonlySet<string>; total: number }
  | { kind: "error"; message: string };

const BulkAdviceStatus = ({ bulk }: { bulk: BulkState }) => (
  <>
    {bulk.kind === "running" ? (
      <p aria-live="polite" className="mt-1 text-xs text-muted-foreground">
        Asking the model for {bulk.total} fix recipes in parallel… takes ~10–20s.
      </p>
    ) : null}
    {bulk.kind === "done" ? (
      <p aria-live="polite" className="mt-1 text-xs text-muted-foreground">
        {bulk.total - bulk.failedCount}/{bulk.total} ready
        {bulk.failedCount > 0 ? ` · ${bulk.failedCount} failed` : ""}. Click any check for details.
      </p>
    ) : null}
    {bulk.kind === "error" ? (
      <p aria-live="polite" className="mt-1 text-xs text-destructive">
        {bulk.message}
      </p>
    ) : null}
  </>
);

export { BulkAdviceStatus };
export type { BulkState };
