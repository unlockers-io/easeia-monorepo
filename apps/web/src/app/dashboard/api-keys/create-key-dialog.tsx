"use client";

import { apiKeyCreateSchema, isSiteScopedScope, type ApiKeyScope } from "@repo/api-types";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";
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

import { createApiKeyAction } from "./actions";

type Props = {
  scopes: ReadonlyArray<ApiKeyScope>;
  sites: ReadonlyArray<{ domain: string; id: string }>;
  siteScopedScopes: ReadonlyArray<ApiKeyScope>;
};

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

const CreateKeyDialog = ({ scopes, sites, siteScopedScopes }: Props) => {
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
                        Up to 80 characters.
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
                      aria-describedby={isInvalid ? "scopes-error" : undefined}
                      data-invalid={isInvalid || undefined}
                    >
                      <FieldLegend variant="label">Scopes</FieldLegend>
                      <div className="flex flex-wrap gap-2">
                        {scopes.map((s) => (
                          <label className="contents" key={s}>
                            <Badge
                              className="cursor-pointer select-none"
                              variant={selected.has(s) ? "default" : "outline"}
                            >
                              <Checkbox
                                aria-invalid={isInvalid}
                                checked={selected.has(s)}
                                onCheckedChange={(checked) => {
                                  field.handleChange(
                                    checked
                                      ? [...field.state.value, s]
                                      : field.state.value.filter((scope) => scope !== s),
                                  );
                                }}
                              />
                              {s}
                            </Badge>
                          </label>
                        ))}
                      </div>
                      {isInvalid && (
                        <FormFieldError errors={field.state.meta.errors} id="scopes-error" />
                      )}
                    </FieldSet>
                  );
                }}
              </form.Field>

              {needsSite &&
                (sites.length === 0 ? (
                  <p className="text-sm text-destructive">
                    {siteScopedScopes.join(", ")} keys are restricted to one site, and no enabled
                    site exists yet. Enable a site first.
                  </p>
                ) : (
                  <form.Field name="siteId">
                    {(field) => {
                      const isInvalid = !field.state.meta.isValid;
                      return (
                        <Field data-invalid={isInvalid || undefined}>
                          <FieldLabel htmlFor="siteId">Site</FieldLabel>
                          <Select
                            onValueChange={(next: string | null) => {
                              field.handleChange(next ?? "");
                            }}
                            value={field.state.value}
                          >
                            <SelectTrigger
                              aria-describedby={
                                isInvalid ? "siteId-description siteId-error" : "siteId-description"
                              }
                              aria-invalid={isInvalid}
                              className="w-full"
                              id="siteId"
                            >
                              <SelectValue placeholder="Pick a site" />
                            </SelectTrigger>
                            <SelectContent>
                              {sites.map((site) => (
                                <SelectItem key={site.id} value={site.id}>
                                  {site.domain}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FieldDescription id="siteId-description">
                            Required: {siteScopedScopes.join(", ")} keys only work against the site
                            they are bound to.
                          </FieldDescription>
                          {isInvalid && (
                            <FormFieldError errors={field.state.meta.errors} id="siteId-error" />
                          )}
                        </Field>
                      );
                    }}
                  </form.Field>
                ))}
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
