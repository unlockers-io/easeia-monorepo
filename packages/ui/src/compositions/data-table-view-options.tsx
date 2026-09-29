"use client";

import type { RowData } from "@tanstack/react-table";
import { Settings2Icon } from "lucide-react";

import { Button } from "../components/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../components/dropdown-menu";
import type { DataTableColumn, DataTableInstance } from "../lib/data-table-features";

type DataTableViewOptionsProps<TData extends RowData> = {
  table: DataTableInstance<TData>;
};

const DataTableViewOptions = <TData extends RowData>({
  table,
}: DataTableViewOptionsProps<TData>) => {
  const items = table.getAllColumns().flatMap((column: DataTableColumn<TData>) => {
    // getCanHide() alone, matching the "Hide" item in DataTableColumnHeader.
    // Also requiring an accessorFn excluded display columns, so a labelled
    // column could be hidden from its header and never restored from here.
    if (!column.getCanHide()) {
      return [];
    }
    return [
      <DropdownMenuCheckboxItem
        checked={column.getIsVisible()}
        key={column.id}
        onCheckedChange={(value) => {
          column.toggleVisibility(value);
        }}
      >
        {column.columnDef.meta?.label ?? column.id}
      </DropdownMenuCheckboxItem>,
    ];
  });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button className="ml-auto" size="default" variant="outline" />}>
        <Settings2Icon className="size-4" />
        View
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {items}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export { DataTableViewOptions };
