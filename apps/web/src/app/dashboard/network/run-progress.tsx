type Progress = {
  counts: { failed: number; skipped: number };
  ended?: "done" | "failed" | null;
  phase?: string;
  rows: ReadonlyArray<{ done: number; label: string; total: number }>;
};

export const RunProgress = ({ counts, ended, phase, rows }: Progress) => (
  <div className="mt-6 rounded border p-4">
    <div className="mb-2 text-sm font-medium">
      Phase: {phase}
      {ended ? ` (${ended})` : ""}
    </div>
    {rows.map(({ done, label, total }) => (
      <div className="flex items-baseline justify-between gap-4 py-1" key={label}>
        <span className="text-sm">{label}</span>
        <span className="font-mono text-sm tabular-nums">
          {done} / {total} ({total === 0 ? 0 : Math.round((done / total) * 100)}%)
        </span>
      </div>
    ))}
    {counts.skipped > 0 ? (
      <p className="mt-2 text-sm text-muted-foreground">Skipped jobs: {counts.skipped}</p>
    ) : null}
    {counts.failed > 0 ? (
      <div className="mt-2 text-sm text-destructive">Failed jobs: {counts.failed}</div>
    ) : null}
  </div>
);
