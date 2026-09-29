"use client";

import dynamic from "next/dynamic";

const VercelAnalytics = dynamic(
  async () => {
    const mod = await import("@vercel/analytics/react");
    return { default: mod.Analytics };
  },
  { ssr: false },
);

const Analytics = () => {
  return process.env.NEXT_PUBLIC_ENABLE_ANALYTICS === "true" ? <VercelAnalytics /> : null;
};

export { Analytics };
