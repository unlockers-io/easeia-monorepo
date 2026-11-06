"use client";

import { Button } from "@repo/ui/components/button";
import { useClientReady } from "@repo/ui/hooks/use-client-ready";
import { useTransition } from "react";
import { toast } from "sonner";

import { recrawlMoneySiteAction } from "./actions";

export const RecrawlMoneySiteButton = ({ id }: { id: string }) => {
  const [pending, startTransition] = useTransition();
  const ready = useClientReady();

  const handleClick = () => {
    startTransition(async () => {
      const result = await recrawlMoneySiteAction(id);

      if (!result.ok) {
        toast.error(result.error);

        return;
      }

      toast.success("Re-crawl queued.");
    });
  };

  return (
    <Button
      aria-busy={pending}
      disabled={!ready || pending}
      onClick={handleClick}
      size="sm"
      variant="outline"
    >
      {pending ? "Queueing…" : "Re-crawl"}
    </Button>
  );
};
