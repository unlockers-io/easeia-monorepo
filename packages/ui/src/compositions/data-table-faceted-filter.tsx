"use client";

import { PlusCircleIcon } from "lucide-react";

import { Badge } from "../components/badge";
import { Button } from "../components/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../components/dropdown-menu";
import { Separator } from "../components/separator";

type FacetedFilterOption = {
  label: string;
  value: string;
};

type DataTableFacetedFilterProps = {
  counts?: Map<string, number>;
  onChange: (value: Array<string>) => void;
  options: Array<FacetedFilterOption>;
  title: string;
  value: Array<string>;
};

const DataTableFacetedFilter = ({
  counts,
  onChange,
  options,
  title,
  value,
}: DataTableFacetedFilterProps) => {
  const selected = new Set(value);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button size="default" variant="outline" />}>
        <PlusCircleIcon className="size-4" />
        {title}
        {selected.size > 0 && (
          <>
            <Separator className="mx-1 h-4" orientation="vertical" />
            <Badge className="lg:hidden" variant="secondary">
              {selected.size}
            </Badge>
            <div className="hidden gap-1 lg:flex">
              {selected.size > 2 ? (
                <Badge variant="secondary">{selected.size} selected</Badge>
              ) : (
                options.flatMap((option) =>
                  selected.has(option.value)
                    ? [
                        <Badge key={option.value} variant="secondary">
                          {option.label}
                        </Badge>,
                      ]
                    : [],
                )
              )}
            </div>
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{title}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {options.map((option) => {
            const isSelected = selected.has(option.value);
            const count = counts?.get(option.value);
            return (
              <DropdownMenuCheckboxItem
                checked={isSelected}
                closeOnClick={false}
                key={option.value}
                onCheckedChange={(checked) => {
                  const next = new Set(selected);
                  if (checked) {
                    next.add(option.value);
                  } else {
                    next.delete(option.value);
                  }
                  onChange([...next]);
                }}
              >
                <span className="flex-1 truncate">{option.label}</span>
                {typeof count === "number" && count > 0 && (
                  <span className="ml-2 text-xs text-muted-foreground tabular-nums">{count}</span>
                )}
              </DropdownMenuCheckboxItem>
            );
          })}
        </DropdownMenuGroup>
        {selected.size > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="justify-center text-center"
              onClick={() => {
                onChange([]);
              }}
            >
              Clear filter
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export { DataTableFacetedFilter };
