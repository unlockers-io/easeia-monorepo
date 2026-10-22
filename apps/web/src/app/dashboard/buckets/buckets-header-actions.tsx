"use client";

import { Button } from "@repo/ui/components/button";
import { Checkbox } from "@repo/ui/components/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@repo/ui/components/dialog";
import { ClientReadyForm } from "@repo/ui/compositions/client-ready-form";
import { FormAlert } from "@repo/ui/compositions/form-alert";
import { useClientReady } from "@repo/ui/hooks/use-client-ready";
import { focusFirstInvalidField } from "@repo/ui/lib/focus-first-invalid-field";
import { revalidateLogic, useForm } from "@tanstack/react-form";
import { Loader2, Settings2, Sparkles } from "lucide-react";
import { useId, useState, useTransition } from "react";

import { CountField } from "@/components/count-field";
import { networkDefaultsSchema } from "@/lib/form-schemas";

import { applyNetworkDefaultsAction, refillAllNeedyBucketsAction } from "./actions";

type RefillState =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "done"; sitesTouched: number; total: number }
  | { kind: "error"; message: string };

type AppliedCounts = { bucketSites: number; cadenceSites: number };

const toNumberOrNull = (value: string): number | null => (value === "" ? null : Number(value));

const NetworkDefaultsDialog = () => {
  const cadenceId = useId();
  const targetId = useId();
  const refillId = useId();
  const overwriteId = useId();

  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState<AppliedCounts | null>(null);
  const ready = useClientReady();

  const form = useForm({
    defaultValues: { bucketRefillAt: "3", bucketTarget: "10", cadenceDays: "7", overwrite: false },
    listeners: {
      onChange: () => {
        setError(null);
        setApplied(null);
      },
    },
    onSubmit: async ({ value }) => {
      setError(null);
      setApplied(null);
      try {
        const result = await applyNetworkDefaultsAction({
          bucketRefillAt: toNumberOrNull(value.bucketRefillAt),
          bucketTarget: toNumberOrNull(value.bucketTarget),
          cadenceDays: toNumberOrNull(value.cadenceDays),
          scope: value.overwrite ? "overwrite" : "unconfigured",
        });
        if (result.errors.length > 0) {
          setError(result.errors.join(" "));
          return;
        }
        setApplied({
          bucketSites: result.bucketSitesUpdated,
          cadenceSites: result.cadenceSitesUpdated,
        });
      } catch {
        setError("Failed to apply defaults");
      }
    },
    onSubmitInvalid: ({ formApi }) => {
      focusFirstInvalidField(formApi.formId);
    },
    validationLogic: revalidateLogic(),
    validators: { onDynamic: networkDefaultsSchema },
  });

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger
        disabled={!ready}
        render={
          <Button size="sm" type="button" variant="outline">
            <Settings2 aria-hidden="true" className="size-4" />
            Set network defaults…
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Set network defaults</DialogTitle>
          <DialogDescription>
            Apply cadence and bucket settings across multiple sites in one shot. Either section is
            optional; leave it blank to skip.
          </DialogDescription>
        </DialogHeader>

        <ClientReadyForm
          className="flex flex-col gap-4"
          id={form.formId}
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void form.handleSubmit();
          }}
        >
          <FormAlert message={error} />
          <fieldset className="flex flex-col gap-2 rounded-md border border-border/60 p-3">
            <legend className="px-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Cadence
            </legend>
            <form.Field name="cadenceDays">
              {(field) => (
                <CountField
                  descriptionId={`${cadenceId}-help`}
                  field={field}
                  id={cadenceId}
                  label="Publish every (days)"
                  placeholder="7"
                />
              )}
            </form.Field>
            <p className="text-xs text-muted-foreground" id={`${cadenceId}-help`}>
              1 to 365 days. Setting cadence enables auto-publish on each matched site.
            </p>
          </fieldset>

          <fieldset className="flex flex-col gap-2 rounded-md border border-border/60 p-3">
            <legend className="px-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Bucket
            </legend>
            <div className="grid grid-cols-2 gap-3">
              <form.Field name="bucketTarget">
                {(field) => (
                  <CountField
                    descriptionId={`${targetId}-help`}
                    field={field}
                    id={targetId}
                    label="Target"
                    placeholder="10"
                  />
                )}
              </form.Field>
              <form.Field name="bucketRefillAt">
                {(field) => (
                  <CountField
                    descriptionId={`${targetId}-help`}
                    field={field}
                    id={refillId}
                    label="Refill when below"
                    placeholder="3"
                  />
                )}
              </form.Field>
            </div>
            <p className="text-xs text-muted-foreground" id={`${targetId}-help`}>
              Both take 1 to 100, with refill at most the target.
            </p>
          </fieldset>

          <form.Field name="overwrite">
            {(field) => (
              <label
                className="flex cursor-pointer items-start gap-2 rounded-md border border-border/60 p-3 hover:bg-muted/40"
                htmlFor={overwriteId}
              >
                <Checkbox
                  checked={field.state.value}
                  id={overwriteId}
                  onCheckedChange={field.handleChange}
                />
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium">Overwrite existing config</span>
                  <span className="text-xs text-muted-foreground">
                    {field.state.value
                      ? "Replaces filled-in fields on every enabled site, including sites already configured."
                      : "Only applies to sites that don't have that field configured yet."}
                  </span>
                </div>
              </label>
            )}
          </form.Field>

          {applied === null ? null : (
            <p aria-live="polite" className="text-xs text-muted-foreground">
              Cadence set on {applied.cadenceSites} site
              {applied.cadenceSites === 1 ? "" : "s"} · Bucket set on {applied.bucketSites} site
              {applied.bucketSites === 1 ? "" : "s"}.
            </p>
          )}

          <DialogFooter>
            <Button
              onClick={() => {
                setOpen(false);
              }}
              size="sm"
              type="button"
              variant="outline"
            >
              Close
            </Button>
            <form.Subscribe selector={(state) => state.isSubmitting}>
              {(pending) => (
                <Button disabled={pending} size="sm" type="submit">
                  {pending ? (
                    <Loader2 aria-hidden="true" className="size-4 motion-safe:animate-spin" />
                  ) : null}
                  Apply
                </Button>
              )}
            </form.Subscribe>
          </DialogFooter>
        </ClientReadyForm>
      </DialogContent>
    </Dialog>
  );
};

const RefillAllButton = ({ aiConfigured }: { aiConfigured: boolean }) => {
  const [state, setState] = useState<RefillState>({ kind: "idle" });
  const [pending, startTransition] = useTransition();
  const ready = useClientReady();

  const handleClick = () => {
    setState({ kind: "running" });
    startTransition(async () => {
      try {
        const result = await refillAllNeedyBucketsAction();
        if (!result.ok) {
          setState({ kind: "error", message: result.error });
          return;
        }
        const { queuedPerSite, sitesTouched } = result.data;
        const total = Object.values(queuedPerSite).reduce((sum, n) => sum + n, 0);
        setState({ kind: "done", sitesTouched, total });
      } catch (error) {
        setState({
          kind: "error",
          message: error instanceof Error ? error.message : "Failed",
        });
      }
    });
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        disabled={!ready || pending || !aiConfigured}
        onClick={handleClick}
        size="sm"
        type="button"
        variant="outline"
      >
        {pending ? (
          <Loader2 aria-hidden="true" className="size-4 motion-safe:animate-spin" />
        ) : (
          <Sparkles aria-hidden="true" className="size-4" />
        )}
        Refill all needy buckets
      </Button>
      {state.kind === "done" ? (
        <p aria-live="polite" className="text-xs text-muted-foreground">
          {state.total} draft{state.total === 1 ? "" : "s"} queued across {state.sitesTouched} site
          {state.sitesTouched === 1 ? "" : "s"}.
        </p>
      ) : null}
      {state.kind === "error" ? (
        <p aria-live="polite" className="text-xs text-destructive">
          {state.message}
        </p>
      ) : null}
    </div>
  );
};

export const BucketsHeaderActions = ({ aiConfigured }: { aiConfigured: boolean }) => (
  <div className="flex items-start gap-2">
    <NetworkDefaultsDialog />
    <RefillAllButton aiConfigured={aiConfigured} />
  </div>
);
