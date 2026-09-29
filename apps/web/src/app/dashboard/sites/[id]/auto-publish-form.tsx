"use client";

import type { SiteLanguage } from "@repo/db/browser";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";
import { Switch } from "@repo/ui/components/switch";
import { Textarea } from "@repo/ui/components/textarea";
import { useReducer, useTransition } from "react";

import { updateAutoPublishAction } from "./actions";

const LANGUAGE_OPTIONS: ReadonlyArray<{ label: string; value: SiteLanguage }> = [
  { label: "Portuguese (Brazil)", value: "PT" },
  { label: "English", value: "EN" },
  { label: "Spanish (Spain)", value: "ES" },
];

const isSiteLanguage = (value: string | null): value is SiteLanguage =>
  value !== null && LANGUAGE_OPTIONS.some((option) => option.value === value);

const formatDate = (date: Date): string => date.toLocaleDateString("en-US", { timeZone: "UTC" });

const formatDateTime = (date: Date): string => date.toLocaleString("en-US", { timeZone: "UTC" });

const formatTime = (date: Date): string => date.toLocaleTimeString("en-US", { timeZone: "UTC" });

const describeStatus = ({
  cadenceDays,
  enabled,
  lastAutoPublishedAt,
}: {
  cadenceDays: number | null;
  enabled: boolean;
  lastAutoPublishedAt: Date | null;
}): string => {
  if (!enabled || cadenceDays === null || Number.isNaN(cadenceDays)) {
    return lastAutoPublishedAt
      ? `Paused. Last auto-published ${formatDate(lastAutoPublishedAt)}.`
      : "Paused. Toggle on + set cadence to start.";
  }
  if (!lastAutoPublishedAt) {
    return "Running. First post lands within the next hour (assuming the bucket has a draft).";
  }
  const nextDue = new Date(lastAutoPublishedAt.getTime() + cadenceDays * 24 * 60 * 60 * 1000);
  const now = Date.now();
  if (nextDue.getTime() <= now) {
    return `Running. Next post lands within the next hour (last: ${formatDate(lastAutoPublishedAt)}).`;
  }
  return `Running. Next post: ${formatDateTime(nextDue)} (last: ${formatDate(lastAutoPublishedAt)}).`;
};

export type AutoPublishFormProps = {
  defaultBucketRefillAt: number | null;
  defaultBucketTarget: number | null;
  defaultCadenceDays: number | null;
  defaultEnabled: boolean;
  defaultLanguage: SiteLanguage;
  defaultTopicHints: string | null;
  lastAutoPublishedAt: Date | null;
  siteId: string;
};

const toStringField = (value: number | null): string => (value === null ? "" : String(value));

const toNumberOrNull = (value: string): number | null => (value === "" ? null : Number(value));

type AutoPublishState = {
  bucketRefillAt: string;
  bucketTarget: string;
  cadenceDays: string;
  enabled: boolean;
  errors: Array<string>;
  language: SiteLanguage;
  savedAt: Date | null;
  topicHints: string;
};

type AutoPublishAction =
  | { type: "enabled.toggle"; value: boolean }
  | { type: "language.set"; value: SiteLanguage }
  | { type: "cadenceDays.set"; value: string }
  | { type: "topicHints.set"; value: string }
  | { type: "bucketTarget.set"; value: string }
  | { type: "bucketRefillAt.set"; value: string }
  | { errors: Array<string>; type: "save.done" };

const autoPublishReducer = (
  state: AutoPublishState,
  action: AutoPublishAction,
): AutoPublishState => {
  switch (action.type) {
    case "enabled.toggle": {
      return { ...state, enabled: action.value };
    }
    case "language.set": {
      return { ...state, language: action.value };
    }
    case "cadenceDays.set": {
      return { ...state, cadenceDays: action.value };
    }
    case "topicHints.set": {
      return { ...state, topicHints: action.value };
    }
    case "bucketTarget.set": {
      return { ...state, bucketTarget: action.value };
    }
    case "bucketRefillAt.set": {
      return { ...state, bucketRefillAt: action.value };
    }
    case "save.done": {
      return {
        ...state,
        errors: action.errors,
        savedAt: action.errors.length === 0 ? new Date() : state.savedAt,
      };
    }
    default: {
      return state;
    }
  }
};

const buildInitialState = (props: AutoPublishFormProps): AutoPublishState => ({
  bucketRefillAt: toStringField(props.defaultBucketRefillAt),
  bucketTarget: toStringField(props.defaultBucketTarget),
  cadenceDays: toStringField(props.defaultCadenceDays),
  enabled: props.defaultEnabled,
  errors: [],
  language: props.defaultLanguage,
  savedAt: null,
  topicHints: props.defaultTopicHints ?? "",
});

export const AutoPublishForm = (props: AutoPublishFormProps) => {
  const { lastAutoPublishedAt, siteId } = props;

  const [state, dispatch] = useReducer(autoPublishReducer, props, buildInitialState);
  const [pending, startTransition] = useTransition();

  const {
    bucketRefillAt,
    bucketTarget,
    cadenceDays,
    enabled,
    errors,
    language,
    savedAt,
    topicHints,
  } = state;

  const handleSave = () => {
    startTransition(async () => {
      const result = await updateAutoPublishAction(siteId, {
        autoPublishEnabled: enabled,
        bucketRefillAt: toNumberOrNull(bucketRefillAt),
        bucketTarget: toNumberOrNull(bucketTarget),
        cadenceDays: toNumberOrNull(cadenceDays),
        language,
        topicHints,
      });
      dispatch({ errors: result.errors, type: "save.done" });
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col">
          <label className="text-sm font-medium" htmlFor={`auto-publish-${siteId}`}>
            Auto-publish enabled
          </label>
          <p className="text-xs text-muted-foreground">
            Set it once. The worker checks every hour and publishes the next pre-generated draft
            from the bucket every {cadenceDays || "N"} day{cadenceDays === "1" ? "" : "s"}.
          </p>
        </div>
        <Switch
          checked={enabled}
          id={`auto-publish-${siteId}`}
          onCheckedChange={(value) => {
            dispatch({ type: "enabled.toggle", value });
          }}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium" htmlFor={`language-${siteId}`}>
          Content language
        </label>
        <Select
          onValueChange={(value) => {
            if (isSiteLanguage(value)) {
              dispatch({ type: "language.set", value });
            }
          }}
          value={language}
        >
          <SelectTrigger id={`language-${siteId}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LANGUAGE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Generation prompt forces this language and the worker rejects drafts that come out in any
          other language.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-label-form">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium" htmlFor={`cadence-${siteId}`}>
            Cadence (days)
          </label>
          <Input
            id={`cadence-${siteId}`}
            inputMode="numeric"
            max={365}
            min={1}
            onChange={(e) => {
              dispatch({ type: "cadenceDays.set", value: e.target.value });
            }}
            placeholder="7"
            type="number"
            value={cadenceDays}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium" htmlFor={`hints-${siteId}`}>
            Topic hints
          </label>
          <Textarea
            id={`hints-${siteId}`}
            onChange={(e) => {
              dispatch({ type: "topicHints.set", value: e.target.value });
            }}
            placeholder="Optional. e.g. 'Focus on destination weddings in coastal Portugal'."
            rows={2}
            value={topicHints}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-schedule-form">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium" htmlFor={`bucket-target-${siteId}`}>
            Bucket target
          </label>
          <Input
            id={`bucket-target-${siteId}`}
            inputMode="numeric"
            max={100}
            min={1}
            onChange={(e) => {
              dispatch({ type: "bucketTarget.set", value: e.target.value });
            }}
            placeholder="10"
            type="number"
            value={bucketTarget}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium" htmlFor={`bucket-refill-${siteId}`}>
            Refill when below
          </label>
          <Input
            id={`bucket-refill-${siteId}`}
            inputMode="numeric"
            max={100}
            min={1}
            onChange={(e) => {
              dispatch({ type: "bucketRefillAt.set", value: e.target.value });
            }}
            placeholder="3"
            type="number"
            value={bucketRefillAt}
          />
        </div>
        <p className="self-end text-xs text-muted-foreground">
          Pre-generated drafts queue up to <strong>target</strong>. When live drafts + in-flight
          generations drop below <strong>refill</strong>, the worker tops back up to target. Leave
          both blank for manual-only refill.
        </p>
      </div>

      {errors.length > 0 ? (
        <ul aria-live="polite" className="flex flex-col gap-0.5 text-xs text-destructive">
          {errors.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      ) : null}

      <div className="flex items-center justify-between gap-3">
        <p aria-live="polite" className="text-xs text-muted-foreground">
          {describeStatus({
            cadenceDays: cadenceDays === "" ? null : Number(cadenceDays),
            enabled,
            lastAutoPublishedAt,
          })}
          {savedAt ? ` · saved ${formatTime(savedAt)}` : ""}
        </p>
        <Button disabled={pending} onClick={handleSave} size="sm" type="button">
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
};
