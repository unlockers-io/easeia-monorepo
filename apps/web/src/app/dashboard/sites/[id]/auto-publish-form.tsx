"use client";

import type { SiteLanguage } from "@repo/db/browser";
import { Button } from "@repo/ui/components/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";
import { Switch } from "@repo/ui/components/switch";
import { Textarea } from "@repo/ui/components/textarea";
import { ClientReadyForm } from "@repo/ui/compositions/client-ready-form";
import { FormAlert } from "@repo/ui/compositions/form-alert";
import { useClientReady } from "@repo/ui/hooks/use-client-ready";
import { focusFirstInvalidField } from "@repo/ui/lib/focus-first-invalid-field";
import { revalidateLogic, useForm, useSelector } from "@tanstack/react-form";
import { useState } from "react";

import { CountField } from "@/components/count-field";
import { autoPublishSchema } from "@/lib/form-schemas";

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

export const AutoPublishForm = (props: AutoPublishFormProps) => {
  const { lastAutoPublishedAt, siteId } = props;
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const ready = useClientReady();

  const form = useForm({
    defaultValues: {
      bucketRefillAt: toStringField(props.defaultBucketRefillAt),
      bucketTarget: toStringField(props.defaultBucketTarget),
      cadenceDays: toStringField(props.defaultCadenceDays),
      enabled: props.defaultEnabled,
      language: props.defaultLanguage,
      topicHints: props.defaultTopicHints ?? "",
    },
    listeners: {
      onChange: () => {
        setError(null);
      },
    },
    onSubmit: async ({ value }) => {
      setError(null);
      const result = await updateAutoPublishAction(siteId, {
        autoPublishEnabled: value.enabled,
        bucketRefillAt: toNumberOrNull(value.bucketRefillAt),
        bucketTarget: toNumberOrNull(value.bucketTarget),
        cadenceDays: toNumberOrNull(value.cadenceDays),
        language: value.language,
        topicHints: value.topicHints,
      });
      if (result.errors.length > 0) {
        setError(result.errors.join(" "));
        return;
      }
      setSavedAt(new Date());
    },
    onSubmitInvalid: ({ formApi }) => {
      focusFirstInvalidField(formApi.formId);
    },
    validationLogic: revalidateLogic(),
    validators: { onDynamic: autoPublishSchema },
  });
  const cadenceDays = useSelector(form.store, (state) => state.values.cadenceDays);
  const enabled = useSelector(form.store, (state) => state.values.enabled);
  const bucketHelpId = `bucket-help-${siteId}`;

  return (
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
        <form.Field name="enabled">
          {(field) => (
            <Switch
              checked={field.state.value}
              disabled={!ready}
              id={`auto-publish-${siteId}`}
              onCheckedChange={field.handleChange}
            />
          )}
        </form.Field>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium" htmlFor={`language-${siteId}`}>
          Content language
        </label>
        <form.Field name="language">
          {(field) => (
            <Select
              onValueChange={(value) => {
                if (isSiteLanguage(value)) {
                  field.handleChange(value);
                }
              }}
              value={field.state.value}
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
          )}
        </form.Field>
        <p className="text-xs text-muted-foreground">
          Generation prompt forces this language and the worker rejects drafts that come out in any
          other language.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-label-form">
        <div className="flex flex-col gap-1">
          <form.Field name="cadenceDays">
            {(field) => (
              <CountField
                descriptionId={`cadence-help-${siteId}`}
                field={field}
                id={`cadence-${siteId}`}
                label="Cadence (days)"
                placeholder="7"
              />
            )}
          </form.Field>
          <p className="text-xs text-muted-foreground" id={`cadence-help-${siteId}`}>
            1 to 365 days.
          </p>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium" htmlFor={`hints-${siteId}`}>
            Topic hints
          </label>
          <form.Field name="topicHints">
            {(field) => (
              <Textarea
                id={`hints-${siteId}`}
                onBlur={field.handleBlur}
                onChange={(e) => {
                  field.handleChange(e.target.value);
                }}
                placeholder="Optional. e.g. 'Focus on destination weddings in coastal Portugal'."
                rows={2}
                value={field.state.value}
              />
            )}
          </form.Field>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-schedule-form">
        <form.Field name="bucketTarget">
          {(field) => (
            <CountField
              descriptionId={bucketHelpId}
              field={field}
              id={`bucket-target-${siteId}`}
              label="Bucket target"
              placeholder="10"
            />
          )}
        </form.Field>
        <form.Field name="bucketRefillAt">
          {(field) => (
            <CountField
              descriptionId={bucketHelpId}
              field={field}
              id={`bucket-refill-${siteId}`}
              label="Refill when below"
              placeholder="3"
            />
          )}
        </form.Field>
        <p className="self-end text-xs text-muted-foreground" id={bucketHelpId}>
          Pre-generated drafts queue up to <strong>target</strong>. When live drafts + in-flight
          generations drop below <strong>refill</strong>, the worker tops back up to target. Both
          take 1 to 100, with refill at most the target. Leave both blank for manual-only refill.
        </p>
      </div>

      <div className="flex items-center justify-between gap-3">
        <p aria-live="polite" className="text-xs text-muted-foreground">
          {describeStatus({
            cadenceDays: cadenceDays === "" ? null : Number(cadenceDays),
            enabled,
            lastAutoPublishedAt,
          })}
          {savedAt ? ` · saved ${formatTime(savedAt)}` : ""}
        </p>
        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(pending) => (
            <Button disabled={pending} size="sm" type="submit">
              {pending ? "Saving…" : "Save"}
            </Button>
          )}
        </form.Subscribe>
      </div>
    </ClientReadyForm>
  );
};
