"use client";

import type { Niche } from "@repo/db/browser";
import { Button } from "@repo/ui/components/button";

export const NicheToggleGroup = ({
  disabled = false,
  onChange,
  options,
  value,
}: {
  disabled?: boolean;
  onChange: (value: Array<Niche>) => void;
  options: ReadonlyArray<Niche>;
  value: ReadonlyArray<Niche>;
}) => {
  const selected = new Set(value);
  return (
    <fieldset aria-label="Niches" className="flex flex-wrap gap-2">
      {options.map((niche) => (
        <Button
          aria-pressed={selected.has(niche)}
          disabled={disabled}
          key={niche}
          onClick={() => {
            onChange(
              selected.has(niche) ? value.filter((item) => item !== niche) : [...value, niche],
            );
          }}
          size="sm"
          type="button"
          variant={selected.has(niche) ? "default" : "outline"}
        >
          {niche.toLowerCase().replaceAll("_", " ")}
        </Button>
      ))}
    </fieldset>
  );
};
