import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";

import { fetchLocalStats } from "./insights";

export const NicheCard = async ({ siteId }: { siteId: string }) => {
  const stats = await fetchLocalStats(siteId);
  const max = stats.byNiche[0]?.count ?? 0;
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Niche distribution</h2>
        </CardTitle>
        <CardDescription>From posts authored in Easeia.</CardDescription>
      </CardHeader>
      <CardContent>
        {stats.byNiche.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No tagged posts yet. Niches populate as you publish through Easeia.
          </p>
        ) : (
          <ul className="flex flex-col gap-2 text-sm">
            {stats.byNiche.map(({ count, niche }) => (
              <li className="flex items-center gap-3" key={niche}>
                <span className="w-32 text-xs font-medium">{niche}</span>
                <div className="relative h-2 flex-1 rounded-full bg-muted">
                  <div
                    className="absolute inset-y-0 left-0 niche-progress-width rounded-full bg-primary"
                    style={{ "--niche-card-width": `${max === 0 ? 0 : (count / max) * 100}%` }}
                  />
                </div>
                <span className="w-8 text-right text-xs tabular-nums">{count}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
};
