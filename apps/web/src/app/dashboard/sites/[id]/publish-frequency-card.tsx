import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";

import { fetchLocalStats } from "./insights";

export const PublishFrequencyCard = async ({ siteId }: { siteId: string }) => {
  const stats = await fetchLocalStats(siteId);
  const max = Math.max(1, ...stats.publishesPerWeek.map((w) => w.count));
  const total = stats.publishesPerWeek.reduce((s, w) => s + w.count, 0);
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Publish frequency</h2>
        </CardTitle>
        <CardDescription>
          Posts published through Easeia, grouped by week. Last 12 weeks · {total} total.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex publish-frequency-min-height items-end gap-1.5">
          {stats.publishesPerWeek.map((w) => (
            <div className="flex flex-1 flex-col items-center gap-1" key={w.weekStart}>
              <div
                className="publish-frequency-height w-full rounded-sm bg-primary/80"
                style={{ "--publish-frequency-card-height": `${(w.count / max) * 80 + 4}px` }}
                title={`${w.count} on week of ${new Date(w.weekStart).toLocaleDateString()}`}
              />
              <span className="text-xs text-muted-foreground tabular-nums">
                {new Date(w.weekStart).toLocaleDateString(undefined, {
                  day: "numeric",
                  month: "short",
                })}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
