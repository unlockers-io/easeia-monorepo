"use client";

import { Niche } from "@repo/db/browser";
import { Input } from "@repo/ui/components/input";
import {
  DataTableFacetedFilter,
  type DataTableInstance,
  DataTableResetButton,
  DataTableViewOptions,
} from "@repo/ui/compositions/data-table";
import { useClientReady } from "@repo/ui/hooks/use-client-ready";
import { SearchIcon } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { type ReactNode, useEffect, useEffectEvent, useRef, useState } from "react";

const SEARCH_DEBOUNCE_MS = 250;

const NICHE_OPTIONS = Object.values(Niche).map((value) => ({ label: value, value }));

export const useUrlFilters = ({ keys, q }: { keys: ReadonlyArray<string>; q: string }) => {
  const { replace } = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [searchInput, setSearchInput] = useState(q);
  const lastPushedQ = useRef(q);

  useEffect(() => {
    if (q !== lastPushedQ.current) {
      setSearchInput(q);
      lastPushedQ.current = q;
    }
  }, [q]);

  const updateParams = (mutate: (params: URLSearchParams) => void) => {
    const next = new URLSearchParams(searchParams.toString());
    mutate(next);
    const qs = next.toString();
    replace(qs ? `${pathname}?${qs}` : pathname);
  };

  const setParam = (key: string, value: string | null) => {
    updateParams((params) => {
      if (value === null || value === "") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    });
  };

  const pushSearch = useEffectEvent((trimmed: string) => {
    lastPushedQ.current = trimmed;
    setParam("q", trimmed);
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

  const handleNichesChange = (next: ReadonlyArray<string>) => {
    updateParams((params) => {
      params.delete("niche");

      for (const niche of next) {
        params.append("niche", niche);
      }
    });
  };

  const handleReset = () => {
    setSearchInput("");
    lastPushedQ.current = "";
    updateParams((params) => {
      for (const key of ["q", "niche", ...keys]) {
        params.delete(key);
      }
    });
  };

  return { handleNichesChange, handleReset, searchInput, setParam, setSearchInput };
};

type NicheRow = { niches: ReadonlyArray<string> };

type Props<TData extends object> = {
  children: ReactNode;
  filters: ReturnType<typeof useUrlFilters>;
  hasFilters: boolean;
  niches: Array<string>;
  placeholder: string;
  rows: ReadonlyArray<NicheRow>;
  table: DataTableInstance<TData>;
};

const countNiches = (rows: ReadonlyArray<NicheRow>): Map<string, number> => {
  const counts = new Map<string, number>();

  for (const niche of rows.flatMap((row) => row.niches)) {
    counts.set(niche, (counts.get(niche) ?? 0) + 1);
  }

  return counts;
};

export const FilterToolbar = <TData extends object>({
  children,
  filters,
  hasFilters,
  niches,
  placeholder,
  rows,
  table,
}: Props<TData>) => {
  const ready = useClientReady();
  const nicheCounts = countNiches(rows);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex h-8 w-full items-center gap-2 sm:max-w-xs">
        <SearchIcon />
        <Input
          disabled={!ready}
          onChange={(event) => {
            filters.setSearchInput(event.target.value);
          }}
          placeholder={placeholder}
          value={filters.searchInput}
        />
      </div>
      <DataTableFacetedFilter
        counts={nicheCounts}
        onChange={filters.handleNichesChange}
        options={NICHE_OPTIONS}
        title="Niche"
        value={niches}
      />
      {children}
      {hasFilters && <DataTableResetButton onReset={filters.handleReset} />}
      <DataTableViewOptions table={table} />
    </div>
  );
};
