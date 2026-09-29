import {
  type CellData,
  type ReactTable,
  type ColumnDef as TanstackColumnDef,
  type Column as TanstackColumn,
  type RowData,
  columnFacetingFeature,
  columnFilteringFeature,
  columnVisibilityFeature,
  createFacetedRowModel,
  createFacetedUniqueValues,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  filterFn_includesString,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_datetime,
  sortFn_text,
  tableFeatures,
} from "@tanstack/react-table";

const dataTableFeatures = tableFeatures({
  columnFacetingFeature,
  columnFilteringFeature,
  columnVisibilityFeature,
  facetedRowModel: createFacetedRowModel(),
  facetedUniqueValues: createFacetedUniqueValues(),
  filteredRowModel: createFilteredRowModel(),
  filterFns: { includesString: filterFn_includesString },
  paginatedRowModel: createPaginatedRowModel(),
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: {
    alphanumeric: sortFn_alphanumeric,
    datetime: sortFn_datetime,
    text: sortFn_text,
  },
});

type DataTableFeatures = typeof dataTableFeatures;

type DataTableInstance<TData extends RowData> = ReactTable<DataTableFeatures, TData>;

type DataTableColumn<TData extends RowData, TValue extends CellData = CellData> = TanstackColumn<
  DataTableFeatures,
  TData,
  TValue
>;

type ColumnDef<TData extends RowData, TValue extends CellData = CellData> = TanstackColumnDef<
  DataTableFeatures,
  TData,
  TValue
>;

export type { ColumnDef, DataTableColumn, DataTableFeatures, DataTableInstance };
export { dataTableFeatures };
