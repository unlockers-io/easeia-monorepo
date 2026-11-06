"use client";

import {
  API_KEY_NAME_MAX_LENGTH,
  API_KEY_SCOPES,
  apiKeyCreateSchema,
  isSiteScopedScope,
  SITE_SCOPED_API_KEY_SCOPES,
  type ApiKeyScope,
} from "@repo/api-types";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Checkbox } from "@repo/ui/components/checkbox";
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
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { ClientReadyForm } from "@repo/ui/compositions/client-ready-form";
import { FormAlert } from "@repo/ui/compositions/form-alert";
import { FormFieldError } from "@repo/ui/compositions/form-field-error";
import { useClientReady } from "@repo/ui/hooks/use-client-ready";
import { focusFirstInvalidField } from "@repo/ui/lib/focus-first-invalid-field";
import { revalidateLogic, useForm, useSelector } from "@tanstack/react-form";
import { Check, Copy, KeyRound, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { SitePicker, type SiteOption } from "@/components/site-picker";

import { createApiKeyAction } from "./actions";

const SITE_SCOPED = SITE_SCOPED_API_KEY_SCOPES.join(", ");

const TokenIssued = ({ token }: { token: string }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch {
      toast.error("Copy failed. Select the token below and copy it manually.");
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <KeyRound className="size-4 text-primary" />
          Token issued
        </DialogTitle>
        <DialogDescription>Copy it now. You won&apos;t be able to read it again.</DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-2">
        <code className="block rounded-md border border-border bg-muted p-3 font-mono text-xs break-all">
          {token}
        </code>
        <Button
          onClick={() => {
            void handleCopy();
          }}
          type="button"
          variant="outline"
        >
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          {copied ? "Copied" : "Copy to clipboard"}
        </Button>
      </div>
      <DialogFooter>
        <DialogClose render={<Button type="button" />}>Done</DialogClose>
      </DialogFooter>
    </>
  );
};

const formSchema = apiKeyCreateSchema.safeExtend({ siteId: z.string() });

const defaultValues: z.input<typeof formSchema> = {
  name: "",
  scopes: [],
  siteId: "",
};

const scopesDescribedBy = (noSite: boolean, invalid: boolean) =>
  [noSite ? "scopes-no-site" : null, invalid ? "scopes-error" : null]
    .filter((id) => id !== null)
    .join(" ") || undefined;

type ScopeOptionProps = {
  checked: boolean;
  disabled: boolean;
  invalid: boolean;
  onCheckedChange: (checked: boolean) => void;
  scope: ApiKeyScope;
};

const ScopeOption = ({ checked, disabled, invalid, onCheckedChange, scope }: ScopeOptionProps) => (
  <label className="contents">
    <Badge className="cursor-pointer select-none" variant={checked ? "default" : "outline"}>
      <Checkbox
        aria-invalid={invalid}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
      />
      {scope}
    </Badge>
  </label>
);

const CreateKeyDialog = ({ sites }: { sites: ReadonlyArray<SiteOption> }) => {
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ready = useClientReady();

  const form = useForm({
    defaultValues,
    listeners: {
      onChange: () => {
        setError(null);
      },
    },
    onSubmit: async ({ value }) => {
      setError(null);

      const result = await createApiKeyAction({
        name: value.name,
        scopes: value.scopes,
        siteId: value.scopes.some(isSiteScopedScope) ? value.siteId : undefined,
      });

      if (!result.ok) {
        setError(result.error);

        return;
      }

      setToken(result.data);
    },
    onSubmitInvalid: ({ formApi }) => {
      focusFirstInvalidField(formApi.formId);
    },
    validationLogic: revalidateLogic(),
    validators: { onDynamic: formSchema },
  });

  const needsSite = useSelector(form.store, (state) => state.values.scopes.some(isSiteScopedScope));

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      form.reset();
      setToken(null);
      setError(null);
    }

    setOpen(next);
  };

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogTrigger
        disabled={!ready}
        render={
          <Button>
            <Plus className="size-4" />
            New key
          </Button>
        }
      />

      <DialogContent className="sm:max-w-lg">
        {token === null ? (
          <ClientReadyForm
            id={form.formId}
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              void form.handleSubmit();
            }}
          >
            <DialogHeader>
              <DialogTitle>Create API key</DialogTitle>
              <DialogDescription>
                Pick scopes carefully. Keys can&apos;t be edited after creation, only revoked.
              </DialogDescription>
            </DialogHeader>

            <FieldGroup className="gap-4 py-2">
              <FormAlert message={error} />
              <form.Field name="name">
                {(field) => {
                  const isInvalid = !field.state.meta.isValid;

                  return (
                    <Field data-invalid={isInvalid || undefined}>
                      <FieldLabel htmlFor="name">Name</FieldLabel>
                      <Input
                        aria-describedby={
                          isInvalid ? "name-description name-error" : "name-description"
                        }
                        aria-invalid={isInvalid}
                        aria-required
                        id="name"
                        onBlur={field.handleBlur}
                        onChange={(e) => {
                          field.handleChange(e.target.value);
                        }}
                        placeholder="N8N integration"
                        value={field.state.value}
                      />
                      <FieldDescription id="name-description">
                        Up to {API_KEY_NAME_MAX_LENGTH} characters.
                      </FieldDescription>
                      {isInvalid && (
                        <FormFieldError errors={field.state.meta.errors} id="name-error" />
                      )}
                    </Field>
                  );
                }}
              </form.Field>

              <form.Field name="scopes">
                {(field) => {
                  const isInvalid = !field.state.meta.isValid;
                  const selected = new Set(field.state.value);

                  return (
                    <FieldSet
                      aria-describedby={scopesDescribedBy(sites.length === 0, isInvalid)}
                      data-invalid={isInvalid || undefined}
                    >
                      <FieldLegend variant="label">Scopes</FieldLegend>
                      <div className="flex flex-wrap gap-2">
                        {API_KEY_SCOPES.map((s) => (
                          <ScopeOption
                            checked={selected.has(s)}
                            disabled={sites.length === 0 && isSiteScopedScope(s)}
                            invalid={isInvalid}
                            key={s}
                            onCheckedChange={(checked) => {
                              field.handleChange(
                                checked
                                  ? [...field.state.value, s]
                                  : field.state.value.filter((scope) => scope !== s),
                              );
                            }}
                            scope={s}
                          />
                        ))}
                      </div>
                      {sites.length === 0 && (
                        <FieldDescription id="scopes-no-site">
                          {SITE_SCOPED} keys are restricted to one site, and no enabled site exists
                          yet. Enable a site to pick them.
                        </FieldDescription>
                      )}
                      {isInvalid && (
                        <FormFieldError errors={field.state.meta.errors} id="scopes-error" />
                      )}
                    </FieldSet>
                  );
                }}
              </form.Field>

              {needsSite && (
                <form.Field name="siteId">
                  {(field) => (
                    <SitePicker
                      description={`Required: ${SITE_SCOPED} keys only work against the site they are bound to.`}
                      field={field}
                      sites={sites}
                    />
                  )}
                </form.Field>
              )}
            </FieldGroup>

            <DialogFooter>
              <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
              <form.Subscribe selector={(state) => state.isSubmitting}>
                {(pending) => (
                  <Button disabled={pending} type="submit">
                    {pending ? "Creating…" : "Create"}
                  </Button>
                )}
              </form.Subscribe>
            </DialogFooter>
          </ClientReadyForm>
        ) : (
          <TokenIssued token={token} />
        )}
      </DialogContent>
    </Dialog>
  );
};

export { CreateKeyDialog };
