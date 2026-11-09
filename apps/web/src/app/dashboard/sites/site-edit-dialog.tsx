"use client";

import { DEFAULT_CATEGORY, siteUpdatePatchSchema } from "@repo/api-types";
import type { Niche } from "@repo/db/browser";
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
import { Field, FieldDescription, FieldLabel } from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { Switch } from "@repo/ui/components/switch";
import { ClientReadyForm } from "@repo/ui/compositions/client-ready-form";
import { FormAlert } from "@repo/ui/compositions/form-alert";
import { FormFieldError } from "@repo/ui/compositions/form-field-error";
import { useClientReady } from "@repo/ui/hooks/use-client-ready";
import { focusFirstInvalidField } from "@repo/ui/lib/focus-first-invalid-field";
import { revalidateLogic, useForm } from "@tanstack/react-form";
import { Plus, Settings2, X } from "lucide-react";
import { useState } from "react";
import { z } from "zod";

import { NicheToggleGroup } from "@/components/niche-toggle-group";

import { updateSiteAction } from "./actions";

type Remap = { id: string; key: string; value: string };

type Props = {
  site: {
    categorySlugMap: Record<string, string>;
    defaultCategory: string;
    domain: string;
    id: string;
    isEnabled: boolean;
    niches: ReadonlyArray<Niche>;
  };
};

const patchFields = siteUpdatePatchSchema.shape;

const remapSchema = z.object({ id: z.string(), key: z.string(), value: z.string() });

const siteEditSchema = z.object({
  defaultCategory: patchFields.defaultCategory,
  isEnabled: patchFields.isEnabled.unwrap(),
  niches: patchFields.niches.unwrap(),
  remaps: z.array(remapSchema),
});

type SiteEditValues = z.input<typeof siteEditSchema>;

const toValues = (site: Props["site"]): SiteEditValues => ({
  defaultCategory: site.defaultCategory,
  isEnabled: site.isEnabled,
  niches: [...site.niches],
  remaps: Object.entries(site.categorySlugMap).map(([key, value]) => ({
    id: crypto.randomUUID(),
    key,
    value,
  })),
});

const toSlugMap = (remaps: ReadonlyArray<Remap>): Record<string, string> =>
  Object.fromEntries(
    remaps.flatMap(({ key, value }) =>
      key.trim() === "" ? [] : [[key.trim(), value.trim()] as const],
    ),
  );

const SiteEditDialog = ({ site }: Props) => {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialValues] = useState(() => toValues(site));
  const ready = useClientReady();
  const fieldId = `site-${site.id}`;

  const form = useForm({
    defaultValues: initialValues,
    listeners: {
      onChange: () => {
        setError(null);
      },
    },
    onSubmit: async ({ value }) => {
      setError(null);

      const result = await updateSiteAction(site.id, {
        categorySlugMap: toSlugMap(value.remaps),
        defaultCategory: value.defaultCategory,
        isEnabled: value.isEnabled,
        niches: value.niches,
      });

      if (!result.ok) {
        setError(result.error);

        return;
      }

      setOpen(false);
    },
    onSubmitInvalid: ({ formApi }) => {
      focusFirstInvalidField(formApi.formId);
    },
    validationLogic: revalidateLogic(),
    validators: { onDynamic: siteEditSchema },
  });

  const handleOpenChange = (next: boolean) => {
    if (next) {
      form.reset(toValues(site));
      setError(null);
    }

    setOpen(next);
  };

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogTrigger
        disabled={!ready}
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

        <ClientReadyForm
          id={form.formId}
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void form.handleSubmit();
          }}
        >
          <div className="flex max-h-popover-viewport flex-col gap-6 overflow-y-auto py-2 pr-1">
            <FormAlert message={error} />
            <form.Field name="isEnabled">
              {(field) => (
                <div className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div>
                    <FieldLabel htmlFor={`${fieldId}-enabled`}>Enabled</FieldLabel>
                    <p className="text-xs text-muted-foreground">
                      Disabled sites refuse new publishes.
                    </p>
                  </div>
                  <Switch
                    checked={field.state.value}
                    id={`${fieldId}-enabled`}
                    onCheckedChange={field.handleChange}
                  />
                </div>
              )}
            </form.Field>

            <form.Field name="niches">
              {(field) => (
                <div className="flex flex-col gap-3">
                  <div>
                    <FieldLabel>Niches</FieldLabel>
                    <p className="text-xs text-muted-foreground">
                      Drives cross-site link relevance and topical clustering.
                    </p>
                  </div>
                  <NicheToggleGroup onChange={field.handleChange} value={field.state.value} />
                </div>
              )}
            </form.Field>

            <form.Field name="defaultCategory">
              {(field) => {
                const isInvalid = !field.state.meta.isValid;
                const inputId = `${fieldId}-default-category`;

                return (
                  <div className="border-t border-border pt-4">
                    <Field data-invalid={isInvalid || undefined}>
                      <FieldLabel htmlFor={inputId}>Default category</FieldLabel>
                      <Input
                        aria-describedby={
                          isInvalid
                            ? `${inputId}-description ${inputId}-error`
                            : `${inputId}-description`
                        }
                        aria-invalid={isInvalid}
                        autoComplete="off"
                        id={inputId}
                        onBlur={field.handleBlur}
                        onChange={(event) => {
                          field.handleChange(event.target.value);
                        }}
                        placeholder={DEFAULT_CATEGORY}
                        spellCheck={false}
                        value={field.state.value}
                      />
                      <FieldDescription id={`${inputId}-description`}>
                        URL segment for posts with no category. Must match this site&rsquo;s{" "}
                        <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
                          category-slugs.json
                        </code>{" "}
                        catch-all.
                      </FieldDescription>
                      {isInvalid && (
                        <FormFieldError errors={field.state.meta.errors} id={`${inputId}-error`} />
                      )}
                    </Field>
                  </div>
                );
              }}
            </form.Field>

            <form.Field name="remaps">
              {(field) => {
                const update = (index: number, patch: Partial<Remap>) => {
                  field.handleChange(
                    field.state.value.map((row, i) => (i === index ? { ...row, ...patch } : row)),
                  );
                };

                return (
                  <div className="flex flex-col gap-3">
                    <div>
                      <FieldLabel>Category URL remap</FieldLabel>
                      <p className="text-xs text-muted-foreground">
                        Maps a category name to a custom URL slug. Unmapped categories are
                        slugified. Keep this in sync with the site&rsquo;s{" "}
                        <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
                          category-slugs.json
                        </code>
                        .
                      </p>
                    </div>
                    <div className="flex flex-col gap-2">
                      {field.state.value.length === 0 ? (
                        <p className="text-xs text-muted-foreground">
                          No remaps; every category slugified.
                        </p>
                      ) : null}
                      {field.state.value.map((row, index) => (
                        <div className="flex items-center gap-2" key={row.id}>
                          <Input
                            aria-label={`Category name ${index + 1}`}
                            autoComplete="off"
                            onChange={(event) => {
                              update(index, { key: event.target.value });
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
                            onChange={(event) => {
                              update(index, { value: event.target.value });
                            }}
                            placeholder="video"
                            spellCheck={false}
                            value={row.value}
                          />
                          <Button
                            aria-label={`Remove remap ${index + 1}`}
                            onClick={() => {
                              field.handleChange(field.state.value.filter((_, i) => i !== index));
                            }}
                            size="icon-sm"
                            type="button"
                            variant="ghost"
                          >
                            <X className="size-4" />
                          </Button>
                        </div>
                      ))}
                      <Button
                        className="w-fit"
                        onClick={() => {
                          field.handleChange([
                            ...field.state.value,
                            { id: crypto.randomUUID(), key: "", value: "" },
                          ]);
                        }}
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        <Plus className="size-4" />
                        Add remap
                      </Button>
                    </div>
                  </div>
                );
              }}
            </form.Field>
          </div>

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
            <form.Subscribe selector={(state) => state.isSubmitting}>
              {(pending) => (
                <Button disabled={pending} type="submit">
                  {pending ? "Saving…" : "Save"}
                </Button>
              )}
            </form.Subscribe>
          </DialogFooter>
        </ClientReadyForm>
      </DialogContent>
    </Dialog>
  );
};

export { SiteEditDialog };
