import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  id?: string;
  intro?: ReactNode;
  /** Two-digit section number; the report's wayfinding. */
  no: string;
  title: string;
  /** Put the body under the head at full width instead of beside it. */
  wide?: boolean;
};

/**
 * A numbered report section on the 12-column grid: index + title + intro in
 * the first four columns, body in the remaining eight (or full width).
 */
const Section = ({ children, id, intro, no, title, wide = false }: Props) => (
  <section className="border-b border-foreground" id={id}>
    <div className="mx-auto grid max-w-(--breakpoint-xl) gap-x-6 gap-y-8 px-6 py-16 md:grid-cols-12 md:px-8 md:py-20">
      <div className={wide ? "md:col-span-12" : "md:col-span-4"}>
        <span
          aria-hidden="true"
          className="block text-(length:--text-label) font-black tabular-nums"
        >
          {no}
        </span>
        <h2 className="mt-2 max-w-(--container-measure-22) text-3xl leading-none font-black tracking-hero text-balance md:text-(length:--text-display-sm)">
          {title}
        </h2>
        {intro === undefined ? null : (
          <div className="mt-4 max-w-(--container-measure-46) text-base text-pretty text-muted-foreground md:text-lg">
            {intro}
          </div>
        )}
      </div>
      <div className={wide ? "md:col-span-12" : "min-w-0 md:col-span-8"}>{children}</div>
    </div>
  </section>
);

export { Section };
