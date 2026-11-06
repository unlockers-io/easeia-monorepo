"use client";

import type { Niche, PostStatus } from "@repo/db/browser";
import { buttonVariants } from "@repo/ui/components/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";
import { type ColumnDef, DataTable, DataTableColumnHeader } from "@repo/ui/compositions/data-table";
import { useClientReady } from "@repo/ui/hooks/use-client-ready";
import { cn } from "@repo/ui/lib/utils";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";

import { FilterToolbar, useUrlFilters } from "@/components/filter-toolbar";
import { formatRelativeTime } from "@/lib/relative-time";

import type { StatusJob } from "./post-state";
import { PostStatusBadge } from "./post-status-badge";

const ALL_SITES = "__all__";

export type PostRow = {
  activityAt: string;
  id: string;
  job: StatusJob | null;
  niches: Array<Niche>;
  publishedAt: string | null;
  scheduledAt: string | null;
  site: { domain: string; id: string };
  status: PostStatus;
  title: string;
};

type SiteOption = { domain: string; id: string };

type PostsTableFilters = {
  niches: Array<string>;
  q: string;
  siteId: string;
};

type PostsTableProps = {
  initialFilters: PostsTableFilters;
  nowMs: number;
  rows: Array<PostRow>;
  sites: Array<SiteOption>;
};

const PostsTable = ({ initialFilters, nowMs, rows, sites }: PostsTableProps) => {
  const ready = useClientReady();
  const filters = useUrlFilters({ keys: ["siteId"], q: initialFilters.q });
  const selectedSite = initialFilters.siteId || ALL_SITES;

  const columns: Array<ColumnDef<PostRow>> = [
    {
      accessorKey: "title",
      cell: ({ row }) => (
        <Link
          className="block max-w-sm truncate font-medium hover:underline"
          href={`/dashboard/posts/${row.original.id}`}
          title={row.original.title}
        >
          {row.original.title}
        </Link>
      ),
      header: ({ column }) => <DataTableColumnHeader column={column} title="Title" />,
      meta: { label: "Title" },
    },
    {
      accessorFn: (row) => row.site.domain,
      cell: ({ row }) => (
        <Link
          className="text-sm text-muted-foreground hover:underline"
          href={`/dashboard/sites/${row.original.site.id}`}
        >
          {row.original.site.domain}
        </Link>
      ),
      header: ({ column }) => <DataTableColumnHeader column={column} title="Site" />,
      id: "site",
      meta: { label: "Site" },
    },
    {
      accessorKey: "status",
      cell: ({ row }) => (
        <PostStatusBadge
          job={row.original.job}
          nowMs={nowMs}
          publishedAt={
            row.original.publishedAt !== null && row.original.publishedAt !== ""
              ? new Date(row.original.publishedAt)
              : null
          }
          scheduledAt={
            row.original.scheduledAt !== null && row.original.scheduledAt !== ""
              ? new Date(row.original.scheduledAt)
              : null
          }
          status={row.original.status}
        />
      ),
      header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
      meta: { label: "Status" },
    },
    {
      accessorKey: "activityAt",
      cell: ({ row }) => (
        <div className="text-right text-xs text-muted-foreground tabular-nums">
          {formatRelativeTime(new Date(row.original.activityAt), nowMs)}
        </div>
      ),
      header: ({ column }) => (
        <div className="flex justify-end">
          <DataTableColumnHeader column={column} title="Activity" />
        </div>
      ),
      meta: { label: "Activity" },
      sortFn: "datetime",
    },
    {
      cell: ({ row }) => {
        return (
          <div className="flex items-center justify-end gap-1">
            <Link
              aria-label={`Open ${row.original.title}`}
              className={cn(buttonVariants({ size: "icon-sm", variant: "ghost" }))}
              href={`/dashboard/posts/${row.original.id}`}
            >
              <ArrowUpRight className="size-4" />
            </Link>
          </div>
        );
      },
      enableHiding: false,
      enableSorting: false,
      header: () => <div className="w-px text-right">Actions</div>,
      id: "actions",
    },
  ];

  const hasFilters =
    filters.searchInput.length > 0 ||
    initialFilters.niches.length > 0 ||
    selectedSite !== ALL_SITES;

  return (
    <DataTable
      caption="Posts"
      columns={columns}
      data={rows}
      emptyState={hasFilters ? "No posts match those filters." : "No posts in this view yet."}
      toolbar={(table) => (
        <FilterToolbar
          filters={filters}
          hasFilters={hasFilters}
          niches={initialFilters.niches}
          placeholder="Search by title…"
          rows={rows}
          table={table}
        >
          <Select
            disabled={!ready}
            onValueChange={(value) => {
              filters.setParam("siteId", value === ALL_SITES ? null : value);
            }}
            value={selectedSite}
          >
            <SelectTrigger size="default">
              <SelectValue>
                {(value: string) => {
                  if (value === ALL_SITES) {
                    return "All";
                  }

                  return sites.find((s) => s.id === value)?.domain ?? value;
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_SITES}>All</SelectItem>
              {sites.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.domain}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterToolbar>
      )}
    />
  );
};

export default PostsTable;
