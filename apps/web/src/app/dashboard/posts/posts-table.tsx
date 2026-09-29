"use client";

import { Niche, type PostStatus } from "@repo/db/browser";
import { Button, buttonVariants } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";
import {
  type ColumnDef,
  DataTable,
  DataTableColumnHeader,
  DataTableFacetedFilter,
  DataTableViewOptions,
} from "@repo/ui/compositions/data-table";
import { cn } from "@repo/ui/lib/utils";
import { ArrowUpRight, SearchIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useEffectEvent, useRef, useState } from "react";

import { formatRelativeTime, type StatusJob } from "./post-state";
import { PostStatusBadge } from "./post-status-badge";

const NICHE_OPTIONS = Object.values(Niche).map((value) => ({ label: value, value }));
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

const SEARCH_DEBOUNCE_MS = 250;

const PostsTable = ({ initialFilters, nowMs: nowMsProp, rows, sites }: PostsTableProps) => {
  const nowMsRef = useRef(nowMsProp);
  useEffect(() => {
    nowMsRef.current = nowMsProp;
  }, [nowMsProp]);
  const { replace } = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [searchInput, setSearchInput] = useState(initialFilters.q);
  const lastPushedQ = useRef(initialFilters.q);

  useEffect(() => {
    if (initialFilters.q !== lastPushedQ.current) {
      setSearchInput(initialFilters.q);
      lastPushedQ.current = initialFilters.q;
    }
  }, [initialFilters.q]);

  const updateParams = (mutate: (params: URLSearchParams) => void) => {
    const next = new URLSearchParams(searchParams.toString());
    mutate(next);
    const qs = next.toString();
    replace(qs ? `${pathname}?${qs}` : pathname);
  };

  const pushSearch = useEffectEvent((trimmed: string) => {
    lastPushedQ.current = trimmed;
    updateParams((params) => {
      if (trimmed) {
        params.set("q", trimmed);
      } else {
        params.delete("q");
      }
    });
  });

  useEffect(() => {
    const trimmed = searchInput.trim();
    if (trimmed === lastPushedQ.current) {
      return undefined;
    }
    const handle = setTimeout(() => {
      pushSearch(trimmed);
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      clearTimeout(handle);
    };
  }, [searchInput]);

  const selectedNiches = initialFilters.niches;
  const selectedSite = initialFilters.siteId || ALL_SITES;

  const handleNichesChange = (next: Array<string>) => {
    updateParams((params) => {
      params.delete("niche");
      for (const n of next) {
        params.append("niche", n);
      }
    });
  };

  const handleSiteChange = (value: string | null) => {
    updateParams((params) => {
      if (value === null || value === "" || value === ALL_SITES) {
        params.delete("siteId");
      } else {
        params.set("siteId", value);
      }
    });
  };

  const nicheCounts = (() => {
    const map = new Map<string, number>();
    for (const row of rows) {
      for (const n of row.niches) {
        map.set(n, (map.get(n) ?? 0) + 1);
      }
    }
    return map;
  })();

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
          nowMs={nowMsRef.current}
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
          {formatRelativeTime(new Date(row.original.activityAt), nowMsRef.current)}
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
    searchInput.length > 0 || selectedNiches.length > 0 || selectedSite !== ALL_SITES;

  const handleReset = () => {
    setSearchInput("");
    lastPushedQ.current = "";
    updateParams((params) => {
      params.delete("q");
      params.delete("niche");
      params.delete("siteId");
    });
  };

  return (
    <DataTable
      caption="Posts"
      columns={columns}
      data={rows}
      emptyState={hasFilters ? "No posts match those filters." : "No posts in this view yet."}
      toolbar={(table) => (
        <div className="flex flex-wrap items-center gap-2">
          <div className={cn("flex items-center gap-2", "h-8 w-full sm:max-w-xs")}>
            <SearchIcon />
            <Input
              onChange={(e) => {
                setSearchInput(e.target.value);
              }}
              placeholder="Search by title…"
              value={searchInput}
            />
          </div>
          <DataTableFacetedFilter
            counts={nicheCounts}
            onChange={handleNichesChange}
            options={NICHE_OPTIONS}
            title="Niche"
            value={selectedNiches}
          />
          <Select onValueChange={handleSiteChange} value={selectedSite}>
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
          {hasFilters && (
            <Button onClick={handleReset} size="default" variant="ghost">
              Reset
              <XIcon className="ml-1 size-4" />
            </Button>
          )}
          <DataTableViewOptions table={table} />
        </div>
      )}
    />
  );
};

export default PostsTable;
