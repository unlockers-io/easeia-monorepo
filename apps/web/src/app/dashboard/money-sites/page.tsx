"use client";
import { Button } from "@repo/ui/components/button";
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
  const [form, setForm] = useState({
    contentPathPrefix: "",
    domain: "",
    name: "",
    sitemapUrl: "",
  });

  const {
    data: items = [],
    isError,
    isPending,
    refetch,
  } = useQuery({
    queryFn: fetchAll,
    queryKey: QUERY_KEY,
  });

  const { isPending: isCreating, mutate: createSite } = useMutation({
    mutationFn: create,
    onError: () => {
      toast.error("Failed to add money site. Please try again.");
    },
    onSuccess: () => {
      setForm({ contentPathPrefix: "", domain: "", name: "", sitemapUrl: "" });
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

  const handleCreate = () => {
    if (!form.domain || !form.sitemapUrl || !form.name) {
      return;
    }
    createSite({
      contentPathPrefix: form.contentPathPrefix || undefined,
      domain: form.domain,
      name: form.name,
      sitemapUrl: form.sitemapUrl,
    });
  };

  return (
    <section className="max-w-3xl p-6">
      <h1 className="text-2xl font-semibold">Money sites</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        External sites the PBN network sends SEO juice to. Each PBN site can be assigned to one
        money site; the rewriter picks topically-relevant money-site pages as link targets.
      </p>

      <div className="mt-6 grid gap-2 rounded border p-4">
        <div className="text-sm font-medium">Add money site</div>
        <input
          aria-label="Name"
          className="rounded border px-2 py-1 text-base sm:text-sm"
          onChange={(e) => {
            setForm((prev) => ({ ...prev, name: e.target.value }));
          }}
          placeholder="Name (e.g., Acme Studios)"
          value={form.name}
        />
        <input
          aria-label="Domain"
          className="rounded border px-2 py-1 text-base sm:text-sm"
          onChange={(e) => {
            setForm((prev) => ({ ...prev, domain: e.target.value }));
          }}
          placeholder="Domain (e.g., acmestudios.example)"
          value={form.domain}
        />
        <input
          aria-label="Sitemap URL"
          className="rounded border px-2 py-1 text-base sm:text-sm"
          onChange={(e) => {
            setForm((prev) => ({ ...prev, sitemapUrl: e.target.value }));
          }}
          placeholder="Sitemap URL"
          value={form.sitemapUrl}
        />
        <input
          aria-label="Content path prefix"
          className="rounded border px-2 py-1 text-base sm:text-sm"
          onChange={(e) => {
            setForm((prev) => ({ ...prev, contentPathPrefix: e.target.value }));
          }}
          placeholder="Content path prefix (optional, e.g., /spaces/)"
          value={form.contentPathPrefix}
        />
        <Button disabled={isCreating} onClick={handleCreate}>
          Add
        </Button>
      </div>

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
