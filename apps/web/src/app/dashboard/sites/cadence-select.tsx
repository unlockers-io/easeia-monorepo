"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";
import { Loader2 } from "lucide-react";
import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";

import { updateSiteCadenceAction } from "./[id]/actions";

const OFF = "off";

const PRESETS: ReadonlyArray<{ days: number; label: string }> = [
  { days: 1, label: "Daily" },
  { days: 2, label: "Every 2 days" },
  { days: 3, label: "Every 3 days" },
  { days: 7, label: "Weekly" },
  { days: 14, label: "Every 14 days" },
  { days: 30, label: "Monthly" },
];

const PRESET_DAYS_SET = new Set(PRESETS.map((p) => p.days));

const toSelectValue = (autoPublishEnabled: boolean, cadenceDays: number | null): string => {
  if (!autoPublishEnabled || cadenceDays === null) {
    return OFF;
  }
  return String(cadenceDays);
};

const labelForValue = (value: string): string => {
  if (value === OFF) {
    return "Off";
  }
  const days = Number(value);
  const preset = PRESETS.find((p) => p.days === days);
  return preset ? preset.label : `Every ${days} days`;
};

export type CadenceSelectProps = {
  autoPublishEnabled: boolean;
  cadenceDays: number | null;
  disabled?: boolean;
  siteId: string;
};

export const CadenceSelect = ({
  autoPublishEnabled,
  cadenceDays,
  disabled,
  siteId,
}: CadenceSelectProps) => {
  const propValue = toSelectValue(autoPublishEnabled, cadenceDays);
  const [optimisticValue, setOptimisticValue] = useOptimistic(propValue, (_, next: string) => next);
  const [pending, startPending] = useTransition();

  const handleChange = (next: string | null) => {
    if (next === null || next === optimisticValue) {
      return;
    }
    startPending(async () => {
      setOptimisticValue(next);
      const cadence = next === OFF ? null : Number(next);
      try {
        await updateSiteCadenceAction(siteId, cadence);
      } catch {
        toast.error("Failed to update cadence. Please try again.");
      }
    });
  };

  const customDays =
    autoPublishEnabled && cadenceDays !== null && !PRESET_DAYS_SET.has(cadenceDays)
      ? cadenceDays
      : null;

  return (
    <Select
      disabled={disabled === true || pending}
      onValueChange={handleChange}
      value={optimisticValue}
    >
      <SelectTrigger className="w-35" size="sm">
        <SelectValue>
          {(value: string) => {
            if (pending) {
              return (
                <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                  <Loader2 className="size-3 motion-safe:animate-spin" /> Saving…
                </span>
              );
            }
            if (value === OFF) {
              return <span className="text-muted-foreground">Off</span>;
            }
            return labelForValue(value);
          }}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={OFF}>Off</SelectItem>
        {PRESETS.map((preset) => (
          <SelectItem key={preset.days} value={String(preset.days)}>
            {preset.label}
          </SelectItem>
        ))}
        {customDays === null ? null : (
          <SelectItem value={String(customDays)}>Every {customDays} days (custom)</SelectItem>
        )}
      </SelectContent>
    </Select>
  );
};
