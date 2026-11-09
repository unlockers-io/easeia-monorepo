"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";
import { useClientReady } from "@repo/ui/hooks/use-client-ready";
import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";

import { assignMoneySiteAction } from "../actions";

type MoneySiteOption = { domain: string; id: string; name: string };

export const MoneySiteDropdown = ({
  currentMoneySiteId,
  id,
  options,
  siteId,
}: {
  currentMoneySiteId: string | null;
  id: string;
  options: ReadonlyArray<MoneySiteOption>;
  siteId: string;
}) => {
  const [optimisticValue, setOptimisticValue] = useOptimistic(
    currentMoneySiteId,
    (_, next: string | null) => next,
  );

  const [isPending, startTransition] = useTransition();
  const ready = useClientReady();

  const items = [
    { label: "(none)", value: null },
    ...options.map((o) => ({ label: `${o.name} (${o.domain})`, value: o.id })),
  ];

  const handleChange = (next: string | null) => {
    startTransition(async () => {
      setOptimisticValue(next);

      const result = await assignMoneySiteAction(siteId, next);

      if (!result.ok) {
        toast.error(result.error);
      }
    });
  };

  return (
    <Select
      disabled={!ready || isPending}
      items={items}
      onValueChange={handleChange}
      value={optimisticValue}
    >
      <SelectTrigger id={id}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item.value ?? "none"} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
