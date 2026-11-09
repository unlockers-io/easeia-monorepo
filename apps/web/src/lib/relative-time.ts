export const formatRelativeTime = (date: Date, nowMs: number): string => {
  const deltaMs = date.getTime() - nowMs;
  const future = deltaMs > 0;
  const seconds = Math.abs(deltaMs) / 1000;

  if (seconds < 60) {
    return future ? "in <1m" : "just now";
  }

  if (seconds < 3600) {
    const m = Math.floor(seconds / 60);

    return future ? `in ${m}m` : `${m}m ago`;
  }

  if (seconds < 86_400) {
    const h = Math.floor(seconds / 3600);

    return future ? `in ${h}h` : `${h}h ago`;
  }

  if (seconds < 2_592_000) {
    const d = Math.floor(seconds / 86_400);

    return future ? `in ${d}d` : `${d}d ago`;
  }

  return date.toLocaleDateString("en-US", { timeZone: "UTC" });
};

export const formatDuration = (ms: number): string => {
  const minutes = Math.round(ms / 60_000);

  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours = Math.round(minutes / 60);

  return hours < 24 ? `${hours}h` : `${Math.round(hours / 24)}d`;
};
