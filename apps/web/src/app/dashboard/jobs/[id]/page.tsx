import { JobStatus, prisma } from "@repo/db";
import { Badge } from "@repo/ui/components/badge";
import { buttonVariants } from "@repo/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import { cn } from "@repo/ui/lib/utils";
import { ArrowLeft, CheckCircle2, Clock, Loader2, XCircle } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

const JobDetailPage = async ({ params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const job = await prisma.job.findUnique({
    include: {
      post: { select: { id: true, slug: true, title: true } },
      site: { select: { domain: true, id: true } },
    },
    where: { id },
  });
  if (!job) {
    notFound();
  }

  const duration =
    job.startedAt && job.finishedAt
      ? `${((job.finishedAt.getTime() - job.startedAt.getTime()) / 1000).toFixed(2)}s`
      : null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          className={cn(buttonVariants({ size: "sm", variant: "ghost" }))}
          href="/dashboard/jobs"
        >
          <ArrowLeft className="size-4" />
          All jobs
        </Link>
      </div>

      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <StatusBadge status={job.status} />
          <Badge variant="outline">
            <span className="inline-flex items-center gap-1 font-mono">{job.kind}</span>
          </Badge>
          <code className="text-xs text-muted-foreground">{job.id}</code>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">
          <JobTitle post={job.post} site={job.site} />
        </h1>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Timing</h2>
          </CardTitle>
          <CardDescription>BullMQ retry counter + DB clock.</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-y-3 text-sm md:grid-cols-4">
            <Term label="Created">{new Date(job.createdAt).toLocaleString()}</Term>
            <Term label="Started">
              {job.startedAt ? new Date(job.startedAt).toLocaleString() : "—"}
            </Term>
            <Term label="Finished">
              {job.finishedAt ? new Date(job.finishedAt).toLocaleString() : "—"}
            </Term>
            <Term label="Duration">{duration ?? "—"}</Term>
            <Term label="Attempts">
              <span className="tabular-nums">{job.attempts}</span>
            </Term>
            <Term label="Queue id">
              <code className="text-xs">{job.queueJobId ?? "—"}</code>
            </Term>
          </dl>
        </CardContent>
      </Card>

      {job.lastError !== null && job.lastError !== "" ? (
        <Card>
          <CardHeader>
            <CardTitle>
              <h2>Last error</h2>
            </CardTitle>
            <CardDescription>Most recent failure captured by the worker.</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="overflow-x-auto rounded-md bg-destructive/5 p-4 font-mono text-xs text-destructive">
              {job.lastError}
            </pre>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Payload</h2>
          </CardTitle>
          <CardDescription>Inputs handed to the worker handler.</CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="overflow-x-auto rounded-md bg-muted p-4 font-mono text-xs">
            {JSON.stringify(job.payload, null, 2)}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
};

const JobTitle = ({
  post,
  site,
}: {
  post: { title: string } | null;
  site: { domain: string } | null;
}) => {
  if (post) {
    return post.title;
  }
  if (site) {
    return site.domain;
  }
  return "Job";
};

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

const Term = ({ children, label }: { children: React.ReactNode; label: string }) => (
  <div className="flex flex-col gap-1">
    <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
    <dd>{children}</dd>
  </div>
);

export default JobDetailPage;
