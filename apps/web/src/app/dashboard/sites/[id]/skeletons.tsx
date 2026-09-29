import { Card, CardHeader, CardTitle, CardContent } from "@repo/ui/components/card";
import { Skeleton } from "@repo/ui/components/skeleton";

export const StatGridSkeleton = () => (
  <div className="overflow-hidden rounded-xl border">
    <div className="grid grid-cols-1 divide-x divide-y divide-border md:grid-cols-3">
      {[0, 1, 2].map((slot) => (
        <div className="flex flex-col gap-1 p-4" key={slot}>
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-7 w-16" />
        </div>
      ))}
    </div>
  </div>
);

export const CardSkeleton = ({ title }: { title: string }) => (
  <Card>
    <CardHeader>
      <CardTitle>
        <h2>{title}</h2>
      </CardTitle>
    </CardHeader>
    <CardContent>
      <Skeleton className="h-32 w-full" />
    </CardContent>
  </Card>
);

export const SectionSkeleton = ({ title }: { title: string }) => (
  <section className="flex flex-col gap-2 p-4">
    <header className="flex flex-col gap-1">
      <h3 className="text-base font-semibold">{title}</h3>
      <Skeleton className="h-3 w-48" />
    </header>
    <Skeleton className="h-24 w-full" />
  </section>
);
