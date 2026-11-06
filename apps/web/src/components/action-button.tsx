"use client";

import { Button } from "@repo/ui/components/button";
import { useClientReady } from "@repo/ui/hooks/use-client-ready";
import { type ComponentProps, useTransition } from "react";
import { toast } from "sonner";

import type { ActionResult } from "@/lib/action-result";

type Props = Omit<ComponentProps<typeof Button>, "onClick" | "type"> & {
  action: () => Promise<ActionResult<unknown>>;
};

export const ActionButton = ({ action, disabled = false, ...props }: Props) => {
  const [pending, startTransition] = useTransition();
  const ready = useClientReady();

  return (
    <Button
      {...props}
      aria-busy={pending}
      disabled={!ready || pending || disabled}
      onClick={() => {
        startTransition(async () => {
          const result = await action();

          if (!result.ok) {
            toast.error(result.error);
          }
        });
      }}
      type="button"
    />
  );
};
