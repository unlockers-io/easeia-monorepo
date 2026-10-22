"use client";

import { siteDomainSchema } from "@repo/api-types/sites";
import { Button } from "@repo/ui/components/button";
import { ClientReadyForm } from "@repo/ui/compositions/client-ready-form";
import { FormAlert } from "@repo/ui/compositions/form-alert";
import { FormFieldError } from "@repo/ui/compositions/form-field-error";
import { focusFirstInvalidField } from "@repo/ui/lib/focus-first-invalid-field";
import { revalidateLogic, useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { unwrapAction } from "@/lib/action-result";

import { listMoneySitesAction, createMoneySiteAction, recrawlMoneySiteAction } from "./actions";

const moneySiteSchema = z.object({
  _count: z.object({ pages: z.number() }),
  contentPathPrefix: z.string().nullable(),
  createdAt: z.coerce.date(),
  domain: z.string(),
  id: z.string(),
  isEnabled: z.boolean(),
  name: z.string(),
  sitemapUrl: z.string(),
});

const moneySitesPayloadSchema = z.object({ data: z.array(moneySiteSchema) });

type MoneySite = z.infer<typeof moneySiteSchema>;

const formSchema = z.object({
  contentPathPrefix: z.string().trim().max(500),
  domain: siteDomainSchema,
  name: z.string().trim().min(1, "Enter a name.").max(200),
  sitemapUrl: z.url({ error: "Enter an HTTP(S) sitemap URL.", protocol: /^https?$/v }),
});

const fields = [
  ["name", "Name", "Name (e.g., Acme Studios)"],
  ["domain", "Domain", "Domain (e.g., acmestudios.example)"],
  ["sitemapUrl", "Sitemap URL", "Sitemap URL"],
  ["contentPathPrefix", "Content path prefix", "Content path prefix (optional, e.g., /spaces/)"],
] as const;

const QUERY_KEY = ["money-sites"] as const;

const fetchAll = async (): Promise<Array<MoneySite>> => {
  const data = unwrapAction(await listMoneySitesAction());

  return moneySitesPayloadSchema.parse({ data }).data;
};

const create = async (input: {
  contentPathPrefix?: string;
  domain: string;
  name: string;
  sitemapUrl: string;
}): Promise<void> => {
  unwrapAction(await createMoneySiteAction(input));
};

const recrawl = async (id: string): Promise<void> => {
  unwrapAction(await recrawlMoneySiteAction(id));
};

const MoneySitesPage = () => {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const {
    data: items = [],
    isError,
    isPending,
    refetch,
  } = useQuery({
    queryFn: fetchAll,
    queryKey: QUERY_KEY,
  });

  const { mutateAsync: createSite } = useMutation({
    mutationFn: create,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });

  const { mutate: recrawlSite } = useMutation({
    mutationFn: recrawl,
    onError: () => {
      toast.error("Failed to trigger re-crawl. Please try again.");
    },
    onSuccess: () => {
      setTimeout(() => {
        void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      }, 1500);
    },
  });

  const form = useForm({
    defaultValues: { contentPathPrefix: "", domain: "", name: "", sitemapUrl: "" },
    listeners: {
      onChange: () => {
        setError(null);
      },
    },
    onSubmit: async ({ formApi, value }) => {
      setError(null);

      try {
        await createSite({
          contentPathPrefix: value.contentPathPrefix || undefined,
          domain: value.domain,
          name: value.name,
          sitemapUrl: value.sitemapUrl,
        });
        formApi.reset();
      } catch (createError) {
        setError(
          createError instanceof Error
            ? createError.message
            : "Failed to add money site. Please try again.",
        );
      }
    },
    onSubmitInvalid: ({ formApi }) => {
      focusFirstInvalidField(formApi.formId);
    },
    validationLogic: revalidateLogic(),
    validators: { onDynamic: formSchema },
  });

  return (
    <section className="max-w-3xl p-6">
      <h1 className="text-2xl font-semibold">Money sites</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        External sites the PBN network sends SEO juice to. Each PBN site can be assigned to one
        money site; the rewriter picks topically-relevant money-site pages as link targets.
      </p>

      <ClientReadyForm
        className="mt-6 grid gap-2 rounded border p-4"
        id={form.formId}
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void form.handleSubmit();
        }}
      >
        <div className="text-sm font-medium">Add money site</div>
        <FormAlert message={error} />
        {fields.map(([name, label, placeholder]) => (
          <form.Field key={name} name={name}>
            {(field) => (
              <>
                <input
                  aria-describedby={
                    field.state.meta.isValid ? undefined : `money-site-${name}-error`
                  }
                  aria-invalid={!field.state.meta.isValid}
                  aria-label={label}
                  className="rounded border px-2 py-1 text-base sm:text-sm"
                  onChange={(e) => {
                    field.handleChange(e.target.value);
                  }}
                  placeholder={placeholder}
                  value={field.state.value}
                />
                <FormFieldError errors={field.state.meta.errors} id={`money-site-${name}-error`} />
              </>
            )}
          </form.Field>
        ))}
        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(isCreating) => (
            <Button disabled={isCreating} type="submit">
              Add
            </Button>
          )}
        </form.Subscribe>
      </ClientReadyForm>

      {isError ? (
        <div className="mt-6 flex flex-col items-start gap-3">
          <p className="text-sm text-destructive">
            Failed to load money sites. Check your connection and retry.
          </p>
          <Button
            onClick={() => {
              void refetch();
            }}
            variant="outline"
          >
            Retry
          </Button>
        </div>
      ) : null}

      {!isPending && !isError && items.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">No money sites yet.</p>
      ) : null}

      <ul className="mt-6 space-y-2">
        {items.map(({ _count, contentPathPrefix, domain, id, name }) => (
          <li className="flex items-center justify-between rounded border p-3" key={id}>
            <div>
              <Link
                className="font-medium hover:underline"
                href={`/dashboard/money-sites/${id}`}
                prefetch
              >
                {name}
              </Link>
              <div className="text-xs text-muted-foreground">
                {domain} · {_count.pages} pages
                {contentPathPrefix !== null && contentPathPrefix !== ""
                  ? ` · prefix ${contentPathPrefix}`
                  : ""}
              </div>
            </div>
            <Button
              onClick={() => {
                recrawlSite(id);
              }}
              size="sm"
              variant="outline"
            >
              Re-crawl
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
};

export default MoneySitesPage;
