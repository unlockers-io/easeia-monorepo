"use client";

import type { CellData, RowData, SortDirection } from "@tanstack/react-table";
import { ArrowDownIcon, ArrowUpIcon, ChevronsUpDownIcon, EyeOffIcon } from "lucide-react";

import { Button } from "../components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../components/dropdown-menu";
import type { DataTableColumn } from "../lib/data-table-features";
import { cn } from "../lib/utils";

type DataTableColumnHeaderProps<TData extends RowData, TValue extends CellData> = {
  className?: string;
  column: DataTableColumn<TData, TValue>;
  title: string;
};

const SortIcon = ({ sorted }: { sorted: false | SortDirection }) => {
  if (sorted === "desc") {
    return <ArrowDownIcon className="size-3.5" />;
  }
  if (sorted === "asc") {
    return <ArrowUpIcon className="size-3.5" />;
  }
  return <ChevronsUpDownIcon className="size-3.5 text-muted-foreground" />;
};

const DataTableColumnHeader = <TData extends RowData, TValue extends CellData>({
  className,
  column,
  title,
}: DataTableColumnHeaderProps<TData, TValue>) => {
  if (!column.getCanSort()) {
    return <div className={cn(className)}>{title}</div>;
  }

  const sorted = column.getIsSorted();

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button className="-ml-2" size="sm" variant="ghost" />}>
          <span>{title}</span>
          <SortIcon sorted={sorted} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem
            onClick={() => {
              column.toggleSorting(false);
            }}
          >
            <ArrowUpIcon className="text-muted-foreground" />
            Asc
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              column.toggleSorting(true);
            }}
          >
            <ArrowDownIcon className="text-muted-foreground" />
            Desc
          </DropdownMenuItem>
          {column.getCanHide() && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => {
                  column.toggleVisibility(false);
                }}
              >
                <EyeOffIcon className="text-muted-foreground" />
                Hide
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

export { DataTableColumnHeader };
