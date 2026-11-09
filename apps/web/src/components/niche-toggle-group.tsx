"use client";

import { Niche } from "@repo/db/browser";
import { Button } from "@repo/ui/components/button";

const NICHES = Object.values(Niche);

export const NicheToggleGroup = ({
  onChange,
  value,
}: {
  onChange: (value: Array<Niche>) => void;
  value: ReadonlyArray<Niche>;
}) => {
  const selected = new Set(value);

  return (
    <fieldset aria-label="Niches" className="flex flex-wrap gap-2">
      {NICHES.map((niche) => (
        <Button
          aria-pressed={selected.has(niche)}
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
