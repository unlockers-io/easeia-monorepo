import type { JobStatus } from "@repo/db/browser";
import { Badge } from "@repo/ui/components/badge";
import { CheckCircle2, Clock, Loader2, MinusCircle, XCircle, type LucideIcon } from "lucide-react";
import type { ComponentProps } from "react";

const statuses = {
  DONE: { icon: CheckCircle2, label: "Done", variant: "default" },
  FAILED: { icon: XCircle, label: "Failed", variant: "destructive" },
  QUEUED: { icon: Clock, label: "Queued", variant: "outline" },
  RUNNING: { icon: Loader2, label: "Running", variant: "secondary" },
  SKIPPED: { icon: MinusCircle, label: "Skipped", variant: "secondary" },
} satisfies Record<
  JobStatus,
  { icon: LucideIcon; label: string; variant: ComponentProps<typeof Badge>["variant"] }
>;

export const JobStatusBadge = ({ status }: { status: JobStatus }) => {
  const { icon: Icon, label, variant } = statuses[status];
  return (
    <Badge variant={variant}>
      <Icon
        aria-hidden="true"
        className={status === "RUNNING" ? "size-3 motion-safe:animate-spin" : "size-3"}
      />
      {label}
    </Badge>
  );
};
