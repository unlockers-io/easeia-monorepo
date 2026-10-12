import type { ReactNode } from "react";

const TONES = {
  error: "border-destructive/40 bg-destructive/5 text-destructive",
  info: "border-border bg-muted text-foreground",
  success: "border-primary/40 bg-primary/5 text-primary",
} as const;

export const Banner = ({ children, tone }: { children: ReactNode; tone: keyof typeof TONES }) => (
  <div className={`rounded-md border px-4 py-2 text-sm ${TONES[tone]}`}>{children}</div>
);
