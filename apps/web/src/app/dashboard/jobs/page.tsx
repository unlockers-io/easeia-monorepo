import { JobStatus, prisma } from "@repo/db";
import type { JobKind } from "@repo/db";
import { Badge } from "@repo/ui/components/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import { Skeleton } from "@repo/ui/components/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/table";
import { ArrowUpRight, CheckCircle2, Clock, Hash, Loader2, XCircle } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

const JobsTable = async () => {
  const jobs = await prisma.job.findMany({
    include: {
      post: { select: { id: true, slug: true, title: true } },
      site: { select: { domain: true, id: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  if (jobs.length === 0) {
    return <p className="px-6 pb-6 text-sm text-muted-foreground">No jobs yet.</p>;
  }

  return (
    <div className="max-h-144 overflow-auto">
      <Table>
        <TableHeader className="sticky top-0 z-10 bg-card">
          <TableRow>
            <TableHead>Kind</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Target</TableHead>
            <TableHead className="text-right">Attempts</TableHead>
            <TableHead className="text-right">Created</TableHead>
            <TableHead className="w-px" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {jobs.map((job) => (
            <TableRow key={job.id}>
              <TableCell>
                <KindBadge kind={job.kind} />
              </TableCell>
              <TableCell>
                <StatusBadge status={job.status} />
              </TableCell>
              <TableCell className="max-w-md truncate text-sm">
                <TargetCell job={job} />
              </TableCell>
              <TableCell className="text-right text-sm tabular-nums">{job.attempts}</TableCell>
              <TableCell className="text-right text-sm text-muted-foreground tabular-nums">
                {new Date(job.createdAt).toLocaleString()}
              </TableCell>
              <TableCell className="text-right">
                <Link
                  aria-label={`Open job ${job.id}`}
                  className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                  href={`/dashboard/jobs/${job.id}`}
                >
                  <ArrowUpRight className="size-4" />
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

const JobsTableSkeleton = () => (
  <div aria-hidden className="flex flex-col gap-2 px-6 pb-6">
    {[0, 1, 2, 3, 4, 5].map((slot) => (
      <Skeleton className="h-10 w-full" key={slot} />
    ))}
  </div>
);

const JobsPage = () => (
  <div className="flex flex-col gap-6">
    <header className="flex flex-col gap-1">
      <h1 className="text-2xl font-semibold tracking-tight">Jobs</h1>
      <p className="text-sm text-muted-foreground">
        Last 100 publish, unpublish, crawl, and embed jobs across the network.
      </p>
    </header>

    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Recent jobs</h2>
        </CardTitle>
        <CardDescription>
          Click a row to inspect the payload, attempts, and any captured error.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        <Suspense fallback={<JobsTableSkeleton />}>
          <JobsTable />
        </Suspense>
      </CardContent>
    </Card>
  </div>
);

type JobRow = {
  id: string;
  post: { id: string; slug: string; title: string } | null;
  site: { domain: string; id: string } | null;
};

const TargetCell = ({ job }: { job: JobRow }) => {
  if (job.post) {
    return (
      <Link className="hover:underline" href={`/dashboard/posts/${job.post.id}`}>
        {job.post.title}
      </Link>
    );
  }
  if (job.site) {
    return (
      <Link className="hover:underline" href={`/dashboard/sites/${job.site.id}`}>
        {job.site.domain}
      </Link>
    );
  }
  return <span className="text-sm text-muted-foreground">—</span>;
};

const KindBadge = ({ kind }: { kind: JobKind }) => (
  <Badge variant="outline">
    <span className="inline-flex items-center gap-1 font-mono">
      <Hash className="size-3" />
      {kind}
    </span>
  </Badge>
);

const StatusBadge = ({ status }: { status: JobStatus }) => {
  if (status === JobStatus.DONE) {
    return (
      <Badge variant="default">
        <CheckCircle2 aria-hidden="true" className="size-3" />
        Done
      </Badge>
    );
  }
  if (status === JobStatus.FAILED) {
    return (
      <Badge variant="destructive">
        <XCircle aria-hidden="true" className="size-3" />
        Failed
      </Badge>
    );
  }
  if (status === JobStatus.RUNNING) {
    return (
      <Badge variant="secondary">
        <Loader2 aria-hidden="true" className="size-3 motion-safe:animate-spin" />
        Running
      </Badge>
    );
  }
  return (
    <Badge variant="outline">
      <Clock aria-hidden="true" className="size-3" />
      Queued
    </Badge>
  );
};

/** @public Next.js app-router reads the instant segment config via the module loader */
export const instant = true;

export default JobsPage;
