import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Table } from "../components/table";

import { TableColumns } from "./table-columns";

describe("TableColumns", () => {
  it("preserves column order, native headers, and alignment", () => {
    render(
      <Table>
        <TableColumns
          columns={[
            { label: "Type" },
            { label: "Anchor" },
            { label: "Target" },
            { className: "text-right", label: "#" },
          ]}
        />
      </Table>,
    );
    expect(screen.getAllByRole("columnheader").map((header) => header.textContent)).toEqual([
      "Type",
      "Anchor",
      "Target",
      "#",
    ]);
    expect(screen.getByRole("columnheader", { name: "#" }).classList.contains("text-right")).toBe(
      true,
    );
  });
});
