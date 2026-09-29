import { Skeleton } from "@repo/ui/components/skeleton";

const DashboardContentSkeleton = () => (
  <div aria-hidden className="flex flex-col gap-6">
    <Skeleton className="h-10 w-64" />
    <Skeleton className="h-64 w-full" />
  </div>
);

export default DashboardContentSkeleton;
