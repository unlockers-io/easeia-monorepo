import { MARK_PATH, MARK_STROKE_WIDTH, MARK_VIEWBOX } from "@repo/ui/lib/brand";
import { cn } from "@repo/ui/lib/utils";

type LogoProps = {
  className?: string;
  /**
   * Forces the whole mark + wordmark to `currentColor`. Use when the logo
   * sits on a solid colored band (buttons, brand CTA) where the
   * theme-adaptive tokens would not contrast.
   */
  monochrome?: boolean;
  variant?: "full" | "mark";
};

const Mark = ({ monochrome }: { monochrome?: boolean }) => {
  return (
    <svg
      aria-hidden="true"
      className="h-wordmark w-auto shrink-0"
      fill="none"
      viewBox={MARK_VIEWBOX}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        className={
          monochrome === true ? "fill-current stroke-current" : "fill-logo-fill stroke-logo-stroke"
        }
        d={MARK_PATH}
        strokeWidth={MARK_STROKE_WIDTH}
      />
    </svg>
  );
};

const Logo = ({ className, monochrome = false, variant = "full" }: LogoProps) => {
  if (variant === "mark") {
    return (
      <span className={cn("inline-flex items-center", className)}>
        <Mark monochrome={monochrome} />
        <span className="sr-only">Easeia</span>
      </span>
    );
  }

  return (
    <span className={cn("inline-flex items-center gap-2 text-lg", className)}>
      <Mark monochrome={monochrome} />
      <span
        className={cn(
          "font-black tracking-tighter",
          monochrome ? "text-current" : "text-logo-text",
        )}
      >
        Easeia
      </span>
    </span>
  );
};

export { Logo };
