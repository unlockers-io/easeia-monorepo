import { Badge } from "@repo/ui/components/badge";
import type { ReactNode } from "react";

export const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className="flex flex-col gap-1">
    <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
    <dd className="text-2xl font-semibold tabular-nums">{value}</dd>
  </div>
);

const rankVariant = (rank: number) => {
  if (rank <= 3) {
    return "default";
  }

  return rank <= 10 ? "secondary" : "outline";
};

export const RankBadge = ({ children, rank }: { children: ReactNode; rank: number }) => (
  <Badge variant={rankVariant(rank)}>{children}</Badge>
);
