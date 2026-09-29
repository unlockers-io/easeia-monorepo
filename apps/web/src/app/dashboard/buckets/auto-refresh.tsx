"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

const POLL_MS = 5000;

export const AutoRefresh = ({ inflight }: { inflight: number }) => {
  const { refresh } = useRouter();
  useEffect(() => {
    if (inflight === 0) {
      return undefined;
    }
    const tick = () => {
      if (document.visibilityState === "visible") {
        refresh();
      }
    };
    const handle = window.setInterval(tick, POLL_MS);
    return () => {
      window.clearInterval(handle);
    };
  }, [refresh, inflight]);
  return null;
};
