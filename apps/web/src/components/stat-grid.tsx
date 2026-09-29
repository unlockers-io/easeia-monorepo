import type { ReactNode } from "react";

type Tone = "default" | "destructive" | "success" | "muted";
type Emphasis = "lead" | "minor";

type ToneClassContract = Record<Tone, string>;

const TONE_CLASS = {
  default: "text-foreground",
  destructive: "text-destructive",
  muted: "text-muted-foreground",
  success: "text-foreground",
} satisfies ToneClassContract;

export type StatItem = {
  /** One-line qualifier printed under the label, e.g. "Across 9 enabled sites". */
  description?: string;
  /** `lead` figures print at display size and take two columns; `minor` ones stay compact. */
  emphasis?: Emphasis;
  href?: string;
  label: string;
  /** Printed after the value at a smaller size, e.g. "/100". */
  suffix?: string;
  tone?: Tone;
  value: ReactNode;
};

type Columns = 2 | 3 | 4 | 5 | 6;

/** Indexed by track count; entries 0 and 1 are unused. */
const LG_GRID: ReadonlyArray<string> = [
  "",
  "",
  "lg:grid-cols-2",
  "lg:grid-cols-3",
  "lg:grid-cols-4",
  "lg:grid-cols-5",
  "lg:grid-cols-6",
  "lg:grid-cols-7",
  "lg:grid-cols-8",
  "lg:grid-cols-9",
  "lg:grid-cols-10",
  "lg:grid-cols-11",
  "lg:grid-cols-12",
];

const VALUE_CLASS = {
  default: "text-3xl font-extrabold tracking-[-0.04em] leading-none",
  lead: "text-5xl font-extrabold tracking-[-0.045em] leading-[0.9] lg:text-[3.5rem]",
  minor: "text-[1.75rem] font-extrabold tracking-[-0.035em] leading-none",
} satisfies Record<Emphasis | "default", string>;

const lgGridClass = (tracks: number): string =>
  LG_GRID[Math.min(Math.max(tracks, 2), 12)] ?? "lg:grid-cols-6";

const StatCell = ({ item }: { item: StatItem }) => {
  const tone = item.tone ?? "default";
  const emphasis = item.emphasis ?? "default";
  const inner = (
    <div className="flex min-w-0 flex-col py-4 md:pr-4">
      <p
        className={`truncate tabular-nums ${VALUE_CLASS[emphasis]} ${TONE_CLASS[tone]}`}
        title={typeof item.value === "string" ? item.value : undefined}
      >
        {item.value}
        {item.suffix === undefined ? null : (
          <span className="ml-0.5 text-lg font-medium tracking-normal text-muted-foreground">
            {item.suffix}
          </span>
        )}
      </p>
      <p className="mt-2 truncate text-xs font-semibold text-muted-foreground" title={item.label}>
        {item.label}
      </p>
      {item.description === undefined ? null : (
        <p className="truncate text-xs text-muted-foreground/80">{item.description}</p>
      )}
    </div>
  );
  const cellClass = `border-b border-border md:border-b-0 md:border-r md:last:border-r-0 ${
    emphasis === "lead" ? "lg:col-span-2" : ""
  }`;
  if (item.href !== undefined && item.href !== "") {
    return (
      <li className={cellClass}>
        <a
          className="block transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
          href={item.href}
        >
          {inner}
        </a>
      </li>
    );
  }
  return <li className={cellClass}>{inner}</li>;
};

/**
 * Key-figures strip: a 4px rule above, a hairline below, cells divided by
 * hairlines. `lead` items take two tracks at `lg` so the numbers that decide
 * whether the operator engages are the ones printed largest.
 */
export const StatGrid = ({
  columns,
  items,
  rule = true,
}: {
  columns: Columns;
  items: ReadonlyArray<StatItem>;
  /** Draw the 4px rule above the strip. Pass `false` when a title rule already sits directly above. */
  rule?: boolean;
}) => {
  const tracks = items.reduce((sum, item) => sum + (item.emphasis === "lead" ? 2 : 1), 0);
  const lg = lgGridClass(items.some((i) => i.emphasis === "lead") ? tracks : columns);
  return (
    <ul
      className={`grid grid-cols-2 gap-x-4 border-b border-b-border md:grid-cols-3 ${
        rule ? "border-t-4 border-t-foreground" : ""
      } ${lg}`}
    >
      {items.map((item) => (
        <StatCell item={item} key={item.label} />
      ))}
    </ul>
  );
};
