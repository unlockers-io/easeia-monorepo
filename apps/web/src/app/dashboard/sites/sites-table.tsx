"use client";

import type { Niche } from "@repo/db/browser";
import { Badge } from "@repo/ui/components/badge";
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
import { ArrowUpRight, ExternalLink } from "lucide-react";
import Link from "next/link";

import { FilterToolbar, useUrlFilters } from "@/components/filter-toolbar";

import { CadenceSelect } from "./cadence-select";
import { SiteEditDialog } from "./site-edit-dialog";

const ALL_STATUSES = "__all__";
const ENABLED = "true";
const DISABLED = "false";
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
  rows: Array<SiteRow>;
};

const isFiltered = (searchInput: string, filters: SitesTableFilters): boolean =>
  searchInput.length > 0 || filters.niches.length > 0 || filters.enabled !== "";

const SitesTable = ({ initialFilters, rows }: SitesTableProps) => {
  const ready = useClientReady();
  const filters = useUrlFilters({ keys: ["enabled"], q: initialFilters.q });
  const statusValue = initialFilters.enabled || ALL_STATUSES;

  const handleStatusChange = (value: string | null) => {
    filters.setParam("enabled", value === ALL_STATUSES ? null : value);
  };

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

  const hasFilters = isFiltered(filters.searchInput, initialFilters);

  return (
    <DataTable
      caption="Sites"
      columns={columns}
      data={rows}
      emptyState={hasFilters ? "No sites match those filters." : "No sites under management yet."}
      toolbar={(table) => (
        <FilterToolbar
          filters={filters}
          hasFilters={hasFilters}
          niches={initialFilters.niches}
          placeholder="Search by domain…"
          rows={rows}
          table={table}
        >
          <Select disabled={!ready} onValueChange={handleStatusChange} value={statusValue}>
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
        </FilterToolbar>
      )}
    />
  );
};

export default SitesTable;
