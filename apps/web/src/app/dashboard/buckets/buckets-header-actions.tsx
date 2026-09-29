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
import { Input } from "@repo/ui/components/input";
import { Loader2, Settings2, Sparkles } from "lucide-react";
import { useId, useReducer, useState, useTransition } from "react";

import { applyNetworkDefaultsAction, refillAllNeedyBucketsAction } from "./actions";

type RefillState =
  | { kind: "idle" }
  | { kind: "running" }
  | { failed: number; kind: "done"; sitesTouched: number; total: number }
  | { kind: "error"; message: string };

type DefaultsState =
  | { kind: "idle" }
  | { kind: "error"; messages: Array<string> }
  | { bucketSites: number; cadenceSites: number; kind: "done" };

const toNumberOrNull = (value: string): number | null => (value === "" ? null : Number(value));

type DialogFormState = {
  bucketRefillAt: string;
  bucketTarget: string;
  cadenceDays: string;
  open: boolean;
  overwrite: boolean;
  result: DefaultsState;
};

type DialogFormAction =
  | { type: "open.set"; value: boolean }
  | { type: "cadenceDays.set"; value: string }
  | { type: "bucketTarget.set"; value: string }
  | { type: "bucketRefillAt.set"; value: string }
  | { type: "overwrite.set"; value: boolean }
  | { result: DefaultsState; type: "result.set" };

const DIALOG_INITIAL_STATE: DialogFormState = {
  bucketRefillAt: "3",
  bucketTarget: "10",
  cadenceDays: "7",
  open: false,
  overwrite: false,
  result: { kind: "idle" },
};

const dialogFormReducer = (state: DialogFormState, action: DialogFormAction): DialogFormState => {
  switch (action.type) {
    case "open.set": {
      return { ...state, open: action.value };
    }
    case "cadenceDays.set": {
      return { ...state, cadenceDays: action.value };
    }
    case "bucketTarget.set": {
      return { ...state, bucketTarget: action.value };
    }
    case "bucketRefillAt.set": {
      return { ...state, bucketRefillAt: action.value };
    }
    case "overwrite.set": {
      return { ...state, overwrite: action.value };
    }
    case "result.set": {
      return { ...state, result: action.result };
    }
    default: {
      return state;
    }
  }
};

const NetworkDefaultsDialog = () => {
  const cadenceId = useId();
  const targetId = useId();
  const refillId = useId();
  const overwriteId = useId();

  const [form, dispatch] = useReducer(dialogFormReducer, DIALOG_INITIAL_STATE);
  const [pending, startTransition] = useTransition();

  const handleSubmit = (event: React.SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    dispatch({ result: { kind: "idle" }, type: "result.set" });
    startTransition(async () => {
      try {
        const result = await applyNetworkDefaultsAction({
          bucketRefillAt: toNumberOrNull(form.bucketRefillAt),
          bucketTarget: toNumberOrNull(form.bucketTarget),
          cadenceDays: toNumberOrNull(form.cadenceDays),
          scope: form.overwrite ? "overwrite" : "unconfigured",
        });
        if (result.errors.length > 0) {
          dispatch({ result: { kind: "error", messages: result.errors }, type: "result.set" });
          return;
        }
        dispatch({
          result: {
            bucketSites: result.bucketSitesUpdated,
            cadenceSites: result.cadenceSitesUpdated,
            kind: "done",
          },
          type: "result.set",
        });
      } catch (error) {
        dispatch({
          result: {
            kind: "error",
            messages: [error instanceof Error ? error.message : "Failed to apply defaults"],
          },
          type: "result.set",
        });
      }
    });
  };

  return (
    <Dialog
      onOpenChange={(value) => {
        dispatch({ type: "open.set", value });
      }}
      open={form.open}
    >
      <DialogTrigger
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

        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <fieldset className="flex flex-col gap-2 rounded-md border border-border/60 p-3">
            <legend className="px-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Cadence
            </legend>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium" htmlFor={cadenceId}>
                Publish every (days)
              </label>
              <Input
                autoComplete="off"
                id={cadenceId}
                inputMode="numeric"
                max={365}
                min={1}
                name="cadenceDays"
                onChange={(e) => {
                  dispatch({ type: "cadenceDays.set", value: e.target.value });
                }}
                placeholder="7"
                type="number"
                value={form.cadenceDays}
              />
              <p className="text-xs text-muted-foreground">
                Setting cadence enables auto-publish on each matched site.
              </p>
            </div>
          </fieldset>

          <fieldset className="flex flex-col gap-2 rounded-md border border-border/60 p-3">
            <legend className="px-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Bucket
            </legend>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium" htmlFor={targetId}>
                  Target
                </label>
                <Input
                  autoComplete="off"
                  id={targetId}
                  inputMode="numeric"
                  max={100}
                  min={1}
                  name="bucketTarget"
                  onChange={(e) => {
                    dispatch({ type: "bucketTarget.set", value: e.target.value });
                  }}
                  placeholder="10"
                  type="number"
                  value={form.bucketTarget}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium" htmlFor={refillId}>
                  Refill when below
                </label>
                <Input
                  autoComplete="off"
                  id={refillId}
                  inputMode="numeric"
                  max={100}
                  min={1}
                  name="bucketRefillAt"
                  onChange={(e) => {
                    dispatch({ type: "bucketRefillAt.set", value: e.target.value });
                  }}
                  placeholder="3"
                  type="number"
                  value={form.bucketRefillAt}
                />
              </div>
            </div>
          </fieldset>

          <label
            className="flex cursor-pointer items-start gap-2 rounded-md border border-border/60 p-3 hover:bg-muted/40"
            htmlFor={overwriteId}
          >
            <Checkbox
              checked={form.overwrite}
              id={overwriteId}
              onCheckedChange={(value) => {
                dispatch({ type: "overwrite.set", value });
              }}
            />
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">Overwrite existing config</span>
              <span className="text-xs text-muted-foreground">
                {form.overwrite
                  ? "Replaces filled-in fields on every enabled site, including sites already configured."
                  : "Only applies to sites that don't have that field configured yet."}
              </span>
            </div>
          </label>

          {form.result.kind === "error" ? (
            <ul aria-live="polite" className="flex flex-col gap-0.5 text-xs text-destructive">
              {form.result.messages.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          ) : null}
          {form.result.kind === "done" ? (
            <p aria-live="polite" className="text-xs text-muted-foreground">
              Cadence set on {form.result.cadenceSites} site
              {form.result.cadenceSites === 1 ? "" : "s"} · Bucket set on {form.result.bucketSites}{" "}
              site{form.result.bucketSites === 1 ? "" : "s"}.
            </p>
          ) : null}

          <DialogFooter>
            <Button
              onClick={() => {
                dispatch({ type: "open.set", value: false });
              }}
              size="sm"
              type="button"
              variant="outline"
            >
              Close
            </Button>
            <Button disabled={pending} size="sm" type="submit">
              {pending ? (
                <Loader2 aria-hidden="true" className="size-4 motion-safe:animate-spin" />
              ) : null}
              Apply
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const RefillAllButton = ({ aiConfigured }: { aiConfigured: boolean }) => {
  const [state, setState] = useState<RefillState>({ kind: "idle" });
  const [pending, startTransition] = useTransition();

  const handleClick = () => {
    setState({ kind: "running" });
    startTransition(async () => {
      try {
        const result = await refillAllNeedyBucketsAction();
        if (!result.ok) {
          setState({ kind: "error", message: result.error });
          return;
        }
        const total = Object.values(result.queuedPerSite).reduce((sum, n) => sum + n, 0);
        setState({
          failed: result.failed,
          kind: "done",
          sitesTouched: result.sitesTouched,
          total,
        });
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
        disabled={pending || !aiConfigured}
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
          {state.sitesTouched === 1 ? "" : "s"}
          {state.failed > 0 ? ` · ${state.failed} failed` : ""}.
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
