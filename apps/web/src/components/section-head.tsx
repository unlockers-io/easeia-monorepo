import type { ReactNode } from "react";

/**
 * Numbered section rule, the report's wayfinding: a two-digit index, the
 * title, and an optional right-aligned aside (counts, links), over a hairline.
 */
export const SectionHead = ({
  aside,
  no,
  title,
}: {
  aside?: ReactNode;
  no: string;
  title: string;
}) => (
  <div className="grid grid-cols-icon-content items-baseline gap-x-4 gap-y-1 border-b border-foreground pb-2 md:grid-cols-section-heading">
    <span aria-hidden="true" className="text-(length:--text-label) font-black tabular-nums">
      {no}
    </span>
    <h2 className="text-lg font-bold tracking-tight">{title}</h2>
    {aside === undefined ? null : (
      <div className="text-(length:--text-label) text-muted-foreground max-md:col-span-2 [&_a]:font-bold [&_a]:text-foreground [&_a]:hover:underline [&_a]:hover:underline-offset-4">
        {aside}
      </div>
    )}
  </div>
);
