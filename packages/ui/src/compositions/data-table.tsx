"use client";

import {
  type ColumnFiltersState,
  type ColumnVisibilityState,
  type RowData,
  type SortingState,
  type TableFeatures,
  flexRender,
  useTable,
} from "@tanstack/react-table";
import { XIcon } from "lucide-react";
import { type ReactNode, useState } from "react";

import { Button } from "../components/button";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/table";
import {
  type ColumnDef,
  type DataTableInstance,
  dataTableFeatures,
} from "../lib/data-table-features";

import { DataTablePagination } from "./data-table-pagination";

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions -- module augmentation must use interface
  interface ColumnMeta<TFeatures extends TableFeatures, TData extends RowData, TValue> {
    label?: string;
  }
}

type DataTableProps<TData extends RowData> = {
  caption?: string;
  columns: Array<ColumnDef<TData>>;
  data: Array<TData>;
  emptyState?: ReactNode;
  initialPageSize?: number;
  toolbar?: (table: DataTableInstance<TData>) => ReactNode;
};

const DataTable = <TData extends RowData>({
  caption,
  columns,
  data,
  emptyState,
  initialPageSize = 25,
  toolbar,
}: DataTableProps<TData>) => {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<ColumnVisibilityState>({});

  const table: DataTableInstance<TData> = useTable({
    columns,
    data,
    features: dataTableFeatures,
    initialState: { pagination: { pageIndex: 0, pageSize: initialPageSize } },
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onSortingChange: setSorting,
    state: { columnFilters, columnVisibility, sorting },
  });

  const rows = table.getRowModel().rows;
  const colSpan = table.getAllLeafColumns().length;

  return (
    <div className="flex flex-col gap-4">
      {toolbar?.(table)}
      <Table>
        {caption !== undefined && caption !== "" ? (
          <TableCaption className="sr-only">{caption}</TableCaption>
        ) : null}
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead colSpan={header.colSpan} key={header.id}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell
                className="h-24 text-center text-sm text-muted-foreground"
                colSpan={colSpan}
              >
                {emptyState ?? "No results."}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow data-state={row.getIsSelected() && "selected"} key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      <DataTablePagination table={table} />
    </div>
  );
};

type DataTableResetButtonProps = {
  onReset: () => void;
};

const DataTableResetButton = ({ onReset }: DataTableResetButtonProps) => (
  <Button onClick={onReset} size="default" variant="ghost">
    Reset
    <XIcon className="ml-1 size-4" />
  </Button>
);

export type { ColumnDef, DataTableColumn, DataTableInstance } from "../lib/data-table-features";
export { DataTableColumnHeader } from "./data-table-column-header";
export { DataTableFacetedFilter } from "./data-table-faceted-filter";
export { DataTablePagination } from "./data-table-pagination";
export { DataTableViewOptions } from "./data-table-view-options";
export { DataTable, DataTableResetButton };
