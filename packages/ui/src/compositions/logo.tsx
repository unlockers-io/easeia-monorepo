import { MARK_PATH, MARK_STROKE_WIDTH, MARK_VIEWBOX } from "@repo/ui/lib/brand";
import { cn } from "@repo/ui/lib/utils";

const Logo = ({ className }: { className?: string }) => (
  <span className={cn("inline-flex items-center gap-2 text-lg", className)}>
    <svg
      aria-hidden="true"
      className="h-wordmark w-auto shrink-0"
      fill="none"
      viewBox={MARK_VIEWBOX}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        className="fill-logo-fill stroke-logo-stroke"
        d={MARK_PATH}
        strokeWidth={MARK_STROKE_WIDTH}
      />
    </svg>
    <span className="font-black tracking-tighter text-logo-text">Easeia</span>
  </span>
);

export { Logo };
