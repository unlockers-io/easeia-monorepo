import { Skeleton, SkeletonBox } from "skullet/react";

const DashboardLoading = () => (
  <Skeleton label="Loading page" loading>
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Loading the latest numbers for this page.</p>
      </header>
      <SkeletonBox height={256} width="100%" />
    </div>
  </Skeleton>
);

export default DashboardLoading;
