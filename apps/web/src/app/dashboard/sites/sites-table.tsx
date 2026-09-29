"use client";

import { Niche } from "@repo/db/browser";
import { Badge } from "@repo/ui/components/badge";
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
import { ArrowUpRight, ExternalLink, SearchIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useEffectEvent, useRef, useState } from "react";

import { CadenceSelect } from "./cadence-select";
import { SiteEditDialog } from "./site-edit-dialog";

const NICHE_OPTIONS = Object.values(Niche).map((value) => ({ label: value, value }));
const ALL_STATUSES = "__all__";
const ENABLED = "enabled";
const DISABLED = "disabled";
const SEARCH_DEBOUNCE_MS = 250;
const MAX_NICHE_BADGES = 3;

export type SiteRow = {
  autoPublishEnabled: boolean;
  cadenceDays: number | null;
  categorySlugMap: Record<string, string>;
  defaultCategory: string;
  domain: string;
  id: string;
  isEnabled: boolean;
  niches: Array<Niche>;
};

type SitesTableFilters = {
  enabled: "" | "true" | "false";
  niches: Array<string>;
  q: string;
};

type SitesTableProps = {
  initialFilters: SitesTableFilters;
  nowMs: number;
  rows: Array<SiteRow>;
};

const statusToValue = (enabled: SitesTableFilters["enabled"]): string => {
  if (enabled === "true") {
    return ENABLED;
  }
  if (enabled === "false") {
    return DISABLED;
  }
  return ALL_STATUSES;
};

const SitesTable = ({ initialFilters, nowMs: nowMsProp, rows }: SitesTableProps) => {
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
  const statusValue = statusToValue(initialFilters.enabled);

  const handleNichesChange = (next: Array<string>) => {
    updateParams((params) => {
      params.delete("niche");
      for (const n of next) {
        params.append("niche", n);
      }
    });
  };

  const handleStatusChange = (value: string | null) => {
    updateParams((params) => {
      if (value === ENABLED) {
        params.set("enabled", "true");
      } else if (value === DISABLED) {
        params.set("enabled", "false");
      } else {
        params.delete("enabled");
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

  const columns: Array<ColumnDef<SiteRow>> = [
    {
      accessorKey: "domain",
      cell: ({ row }) => (
        <div className="flex items-center">
          <Link
            className="font-medium hover:underline"
            href={`/dashboard/sites/${row.original.id}`}
          >
            {row.original.domain}
          </Link>
          <a
            aria-label={`Visit ${row.original.domain}`}
            className="ml-2 inline-flex size-4 align-middle text-muted-foreground hover:text-foreground"
            href={`https://${row.original.domain}`}
            rel="noreferrer"
            target="_blank"
          >
            <ExternalLink className="size-3.5" />
          </a>
        </div>
      ),
      header: ({ column }) => <DataTableColumnHeader column={column} title="Domain" />,
      meta: { label: "Domain" },
    },
    {
      cell: ({ row }) => {
        const visible = row.original.niches.slice(0, MAX_NICHE_BADGES);
        const overflow = row.original.niches.length - visible.length;
        if (row.original.niches.length === 0) {
          return <span className="text-xs text-muted-foreground">—</span>;
        }
        return (
          <div className="flex flex-wrap items-center gap-1">
            {visible.map((n) => (
              <Badge key={n} variant="secondary">
                {n}
              </Badge>
            ))}
            {overflow > 0 && <span className="text-xs text-muted-foreground">+{overflow}</span>}
          </div>
        );
      },
      enableSorting: false,
      header: () => <span className="text-xs">Niches</span>,
      id: "niches",
      meta: { label: "Niches" },
    },
    {
      accessorKey: "isEnabled",
      cell: ({ row }) =>
        row.original.isEnabled ? (
          <Badge variant="default">Enabled</Badge>
        ) : (
          <Badge variant="outline">Disabled</Badge>
        ),
      header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
      meta: { label: "Status" },
    },
    {
      cell: ({ row }) => (
        <CadenceSelect
          autoPublishEnabled={row.original.autoPublishEnabled}
          cadenceDays={row.original.cadenceDays}
          disabled={!row.original.isEnabled}
          siteId={row.original.id}
        />
      ),
      enableSorting: false,
      header: () => <span className="text-xs">Auto-publish</span>,
      id: "autoPublish",
      meta: { label: "Auto-publish" },
    },
    {
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-1">
          <SiteEditDialog
            allNiches={Object.values(Niche)}
            site={{
              categorySlugMap: row.original.categorySlugMap,
              defaultCategory: row.original.defaultCategory,
              domain: row.original.domain,
              id: row.original.id,
              isEnabled: row.original.isEnabled,
              niches: row.original.niches,
            }}
          />
          <Link
            aria-label={`Open ${row.original.domain} insights`}
            className={cn(buttonVariants({ size: "icon-sm", variant: "ghost" }))}
            href={`/dashboard/sites/${row.original.id}`}
          >
            <ArrowUpRight className="size-4" />
          </Link>
        </div>
      ),
      enableHiding: false,
      enableSorting: false,
      header: () => <div className="w-px text-right">Actions</div>,
      id: "actions",
    },
  ];

  const hasFilters =
    searchInput.length > 0 || selectedNiches.length > 0 || statusValue !== ALL_STATUSES;

  const handleReset = () => {
    setSearchInput("");
    lastPushedQ.current = "";
    updateParams((params) => {
      params.delete("q");
      params.delete("niche");
      params.delete("enabled");
    });
  };

  return (
    <DataTable
      caption="Sites"
      columns={columns}
      data={rows}
      emptyState={hasFilters ? "No sites match those filters." : "No sites under management yet."}
      toolbar={(table) => (
        <div className="flex flex-wrap items-center gap-2">
          <div className={cn("flex items-center gap-2", "h-8 w-full sm:max-w-xs")}>
            <SearchIcon />
            <Input
              onChange={(e) => {
                setSearchInput(e.target.value);
              }}
              placeholder="Search by domain…"
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
          <Select onValueChange={handleStatusChange} value={statusValue}>
            <SelectTrigger size="default">
              <SelectValue>
                {(value: string) => {
                  if (value === ENABLED) {
                    return "Enabled";
                  }
                  if (value === DISABLED) {
                    return "Disabled";
                  }
                  return "All";
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_STATUSES}>All</SelectItem>
              <SelectItem value={ENABLED}>Enabled</SelectItem>
              <SelectItem value={DISABLED}>Disabled</SelectItem>
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

export default SitesTable;
