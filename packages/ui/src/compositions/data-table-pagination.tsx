"use client";

import type { RowData } from "@tanstack/react-table";
import {
  ChevronsLeftIcon,
  ChevronsRightIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "lucide-react";

import { Button } from "../components/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/select";
import type { DataTableInstance } from "../lib/data-table-features";

const PAGE_SIZES = [10, 25, 50, 100];

type DataTablePaginationProps<TData extends RowData> = {
  table: DataTableInstance<TData>;
};

const DataTablePagination = <TData extends RowData>({ table }: DataTablePaginationProps<TData>) => {
  const { pageIndex, pageSize } = table.state.pagination;
  const pageCount = table.getPageCount();
  const totalRows = table.getFilteredRowModel().rows.length;
  const firstRow = totalRows === 0 ? 0 : pageIndex * pageSize + 1;
  const lastRow = Math.min(totalRows, (pageIndex + 1) * pageSize);

  return (
    <div className="flex flex-col items-center justify-between gap-3 p-2 sm:flex-row">
      <p className="text-xs text-muted-foreground tabular-nums">
        {totalRows === 0 ? "No rows" : `${firstRow}–${lastRow} of ${totalRows}`}
      </p>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <p className="text-xs text-muted-foreground">Rows per page</p>
          <Select
            onValueChange={(value) => {
              if (value !== null) {
                table.setPageSize(Number(value));
              }
            }}
            value={`${pageSize}`}
          >
            <SelectTrigger className="w-18" size="default">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZES.map((size) => (
                <SelectItem key={size} value={`${size}`}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p className="text-xs text-muted-foreground tabular-nums">
          Page {pageCount === 0 ? 0 : pageIndex + 1} of {pageCount}
        </p>
        <div className="flex items-center gap-1">
          <Button
            aria-label="First page"
            disabled={!table.getCanPreviousPage()}
            onClick={() => {
              table.setPageIndex(0);
            }}
            size="icon-sm"
            variant="outline"
          >
            <ChevronsLeftIcon className="size-4" />
          </Button>
          <Button
            aria-label="Previous page"
            disabled={!table.getCanPreviousPage()}
            onClick={() => {
              table.previousPage();
            }}
            size="icon-sm"
            variant="outline"
          >
            <ChevronLeftIcon className="size-4" />
          </Button>
          <Button
            aria-label="Next page"
            disabled={!table.getCanNextPage()}
            onClick={() => {
              table.nextPage();
            }}
            size="icon-sm"
            variant="outline"
          >
            <ChevronRightIcon className="size-4" />
          </Button>
          <Button
            aria-label="Last page"
            disabled={!table.getCanNextPage()}
            onClick={() => {
              table.setPageIndex(pageCount - 1);
            }}
            size="icon-sm"
            variant="outline"
          >
            <ChevronsRightIcon className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export { DataTablePagination };
