"use client";

import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";

import { assignMoneySiteAction } from "@/app/dashboard/sites/[id]/actions";

export type MoneySiteOption = { domain: string; id: string; name: string };

export const MoneySiteDropdown = ({
  currentMoneySiteId,
  options,
  siteId,
}: {
  currentMoneySiteId: string | null;
  options: ReadonlyArray<MoneySiteOption>;
  siteId: string;
}) => {
  const [optimisticValue, setOptimisticValue] = useOptimistic(
    currentMoneySiteId ?? "",
    (_, next: string) => next,
  );
  const [isPending, startTransition] = useTransition();

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextValue = e.target.value;
    startTransition(async () => {
      setOptimisticValue(nextValue);
      try {
        await assignMoneySiteAction(siteId, nextValue || null);
      } catch {
        toast.error("Failed to assign money site. Please try again.");
      }
    });
  };

  return (
    <select
      aria-label="Money site"
      className="rounded border px-2 py-1 text-base sm:text-sm"
      disabled={isPending}
      onChange={handleChange}
      value={optimisticValue}
    >
      <option value="">(none)</option>
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.name} ({o.domain})
        </option>
      ))}
    </select>
  );
};
