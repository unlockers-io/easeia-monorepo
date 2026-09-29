"use client";

import type { Niche } from "@repo/db";
import { Button } from "@repo/ui/components/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@repo/ui/components/dialog";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { Switch } from "@repo/ui/components/switch";
import { Plus, Settings2, X } from "lucide-react";
import { useState, useTransition } from "react";

import { updateSiteAction } from "../actions";

import { NicheToggleGroup } from "./niche-toggle-group";

type MapRow = { id: string; key: string; value: string };

type Props = {
  allNiches: ReadonlyArray<Niche>;
  site: {
    categorySlugMap: Record<string, string>;
    defaultCategory: string;
    domain: string;
    id: string;
    isEnabled: boolean;
    niches: ReadonlyArray<Niche>;
  };
};

const toRows = (map: Record<string, string>): Array<MapRow> =>
  Object.entries(map).map(([key, value]) => ({ id: crypto.randomUUID(), key, value }));

const rowsToMap = (rows: ReadonlyArray<MapRow>) => {
  const out = new Map<string, string>();
  for (const { key, value } of rows) {
    const trimmedKey = key.trim();
    if (trimmedKey.length > 0) {
      out.set(trimmedKey, value.trim());
    }
  }
  return out;
};

const SiteEditDialog = ({ allNiches, site }: Props) => {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [isEnabled, setIsEnabled] = useState(site.isEnabled);
  const [niches, setNiches] = useState<Set<Niche>>(() => new Set(site.niches));
  const [defaultCategory, setDefaultCategory] = useState(site.defaultCategory);
  const [mapRows, setMapRows] = useState<Array<MapRow>>(() => toRows(site.categorySlugMap));

  const handleOpenChange = (next: boolean) => {
    if (next) {
      setIsEnabled(site.isEnabled);
      setNiches(new Set(site.niches));
      setDefaultCategory(site.defaultCategory);
      setMapRows(toRows(site.categorySlugMap));
    }
    setOpen(next);
  };

  const updateRow = (index: number, patch: Partial<MapRow>) => {
    setMapRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const addRow = () => {
    setMapRows((prev) => [...prev, { id: crypto.randomUUID(), key: "", value: "" }]);
  };

  const removeRow = (index: number) => {
    setMapRows((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    const fd = new FormData();
    fd.set("id", site.id);
    if (isEnabled) {
      fd.set("isEnabled", "on");
    }
    for (const n of niches) {
      fd.append("niches", n);
    }
    fd.set("defaultCategory", defaultCategory.trim() || "sem-categoria");
    const categorySlugMap = Object.fromEntries(rowsToMap(mapRows));
    fd.set("categorySlugMap", JSON.stringify(categorySlugMap));
    startTransition(async () => {
      await updateSiteAction(fd);
      setOpen(false);
    });
  };

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogTrigger
        render={
          <Button aria-label={`Edit ${site.domain}`} size="icon-sm" variant="ghost">
            <Settings2 className="size-4" />
          </Button>
        }
      />

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{site.domain}</DialogTitle>
          <DialogDescription>
            Edit niches, publishing state, and public URL settings.
          </DialogDescription>
        </DialogHeader>

        <div className="flex max-h-popover-viewport flex-col gap-6 overflow-y-auto py-2 pr-1">
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <Label>Enabled</Label>
              <p className="text-xs text-muted-foreground">Disabled sites refuse new publishes.</p>
            </div>
            <Switch checked={isEnabled} onCheckedChange={setIsEnabled} />
          </div>

          <div className="flex flex-col gap-3">
            <div>
              <Label>Niches</Label>
              <p className="text-xs text-muted-foreground">
                Drives cross-site link relevance and topical clustering.
              </p>
            </div>
            <NicheToggleGroup
              onChange={(value) => {
                setNiches(new Set(value));
              }}
              options={allNiches}
              value={[...niches]}
            />
          </div>

          <div className="flex flex-col gap-3 border-t border-border pt-4">
            <div>
              <Label htmlFor={`default-category-${site.id}`}>Default category</Label>
              <p className="text-xs text-muted-foreground">
                URL segment for posts with no category. Must match this site&rsquo;s{" "}
                <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
                  category-slugs.json
                </code>{" "}
                catch-all.
              </p>
            </div>
            <Input
              autoComplete="off"
              id={`default-category-${site.id}`}
              name="defaultCategory"
              onChange={(e) => {
                setDefaultCategory(e.target.value);
              }}
              placeholder="sem-categoria"
              spellCheck={false}
              value={defaultCategory}
            />
          </div>

          <div className="flex flex-col gap-3">
            <div>
              <Label>Category URL remap</Label>
              <p className="text-xs text-muted-foreground">
                Maps a category name to a custom URL slug. Unmapped categories are slugified. Keep
                this in sync with the site&rsquo;s{" "}
                <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
                  category-slugs.json
                </code>
                .
              </p>
            </div>
            <div className="flex flex-col gap-2">
              {mapRows.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No remaps; every category slugified.
                </p>
              ) : null}
              {mapRows.map((row, index) => (
                <div className="flex items-center gap-2" key={row.id}>
                  <Input
                    aria-label={`Category name ${index + 1}`}
                    autoComplete="off"
                    onChange={(e) => {
                      updateRow(index, { key: e.target.value });
                    }}
                    placeholder="Edição de Vídeo"
                    spellCheck={false}
                    value={row.key}
                  />
                  <span aria-hidden className="text-muted-foreground">
                    →
                  </span>
                  <Input
                    aria-label={`URL slug ${index + 1}`}
                    autoComplete="off"
                    onChange={(e) => {
                      updateRow(index, { value: e.target.value });
                    }}
                    placeholder="video"
                    spellCheck={false}
                    value={row.value}
                  />
                  <Button
                    aria-label={`Remove remap ${index + 1}`}
                    onClick={() => {
                      removeRow(index);
                    }}
                    size="icon-sm"
                    type="button"
                    variant="ghost"
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              ))}
              <Button className="w-fit" onClick={addRow} size="sm" type="button" variant="outline">
                <Plus className="size-4" />
                Add remap
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
          <Button disabled={pending} onClick={handleSave} type="button">
            {pending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export { SiteEditDialog };
