import { TableHead, TableHeader, TableRow } from "../components/table";

type Column = { className?: string; label: string };

const TableColumns = ({ columns }: { columns: ReadonlyArray<Column> }) => (
  <TableHeader>
    <TableRow>
      {columns.map(({ className, label }) => (
        <TableHead className={className} key={label}>
          {label}
        </TableHead>
      ))}
    </TableRow>
  </TableHeader>
);

export { TableColumns };
