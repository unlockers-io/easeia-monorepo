"use client";

import type { Niche } from "@repo/db";
import { Badge } from "@repo/ui/components/badge";
import { Checkbox } from "@repo/ui/components/checkbox";
import { useState } from "react";

type Props = {
  niches: ReadonlyArray<Niche>;
};

const NicheSelector = ({ niches }: Props) => {
  const [selected, setSelected] = useState<Set<Niche>>(new Set());

  const toggle = (n: Niche) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(n)) {
        next.delete(n);
      } else {
        next.add(n);
      }
      return next;
    });
  };

  return (
    <div className="flex flex-wrap gap-2">
      {/* Hidden inputs are what the form submits; the badge buttons are
          purely a presentational toggle layered on top. */}
      {[...selected].map((n) => (
        <input key={n} name="niches" type="hidden" value={n} />
      ))}
      {niches.map((n) => {
        const active = selected.has(n);
        return (
          <button
            aria-pressed={active}
            className="contents"
            key={n}
            onClick={() => {
              toggle(n);
            }}
            type="button"
          >
            <Badge className="cursor-pointer select-none" variant={active ? "default" : "outline"}>
              <Checkbox checked={active} className="pointer-events-none" tabIndex={-1} />
              {n}
            </Badge>
          </button>
        );
      })}
    </div>
  );
};

export { NicheSelector };
