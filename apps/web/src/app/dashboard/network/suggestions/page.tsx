"use client";
import { Button } from "@repo/ui/components/button";
import { useInfiniteQuery, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";

import { unwrapAction } from "@/lib/action-result";

import { listSuggestionsAction, decideSuggestionAction } from "../actions";

const postRefSchema = z.object({
  id: z.string(),
  site: z.object({ domain: z.string() }),
  slug: z.string(),
  title: z.string(),
});

const suggestionSchema = z.object({
  anchorText: z.string(),
  fromPost: postRefSchema,
  id: z.string(),
  suggestedAt: z.coerce.date().nullable(),
  toPost: postRefSchema.nullable(),
  type: z.enum(["INTERNAL", "PBN", "EXTERNAL"]),
});

const suggestionPageSchema = z.object({
  data: z.array(suggestionSchema),
  meta: z.object({ nextCursor: z.string().nullable() }),
});

type SuggestionPage = z.infer<typeof suggestionPageSchema>;

const QUERY_KEY = ["suggestions"] as const;
const INITIAL_PAGE_PARAM: string | null = null;
const fetchList = async (cursor: string | null): Promise<SuggestionPage> =>
  suggestionPageSchema.parse(
    unwrapAction(await listSuggestionsAction({ cursor: cursor ?? undefined, limit: 20 })),
  );
const decide = async (id: string, action: "approve" | "reject"): Promise<void> => {
  unwrapAction(await decideSuggestionAction(id, action));
};

const SuggestionsPage = () => {
  const queryClient = useQueryClient();
  const { data, fetchNextPage, hasNextPage, isError, isFetchingNextPage, isPending, refetch } =
    useInfiniteQuery({
      getNextPageParam: (last: SuggestionPage) => last.meta.nextCursor,
      initialPageParam: INITIAL_PAGE_PARAM,
      queryFn: ({ pageParam }) => fetchList(pageParam),
      queryKey: QUERY_KEY,
    });
  const rows = data?.pages.flatMap((page) => page.data) ?? [];

  const handleDecide = async (id: string, action: "approve" | "reject") => {
    try {
      await decide(id, action);
      queryClient.setQueryData<InfiniteData<SuggestionPage, string | null>>(QUERY_KEY, (prev) =>
        prev
          ? {
              ...prev,
              pages: prev.pages.map((page) => ({
                ...page,
                data: page.data.filter((r) => r.id !== id),
              })),
            }
          : prev,
      );
    } catch {
      toast.error(`Failed to ${action} suggestion. Please try again.`);
    }
  };

  return (
    <section className="max-w-4xl p-6">
      <h1 className="text-2xl font-semibold">Suggested links</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Pending suggestions across the network. Approve or reject each row. Approved suggestions are
        not yet applied to post bodies; that&apos;s a separate step.
      </p>

      {isError ? (
        <div className="mt-6 flex flex-col items-start gap-3">
          <p className="text-sm text-destructive">
            Failed to load suggestions. Check your connection and retry.
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

      {!isPending && !isError && rows.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">No pending suggestions.</p>
      ) : null}

      <ul className="mt-6 space-y-3">
        {rows.map((s) => (
          <li className="rounded border p-3" key={s.id}>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{s.type}</span>
              <span>·</span>
              <span>
                {s.suggestedAt === null
                  ? ""
                  : new Date(s.suggestedAt).toLocaleString("en-US", { timeZone: "UTC" })}
              </span>
            </div>
            <div className="mt-1 text-sm">
              <span className="font-medium">{s.fromPost.site.domain}</span> /{" "}
              <span>{s.fromPost.title}</span>
            </div>
            <div className="mt-0.5 text-sm text-muted-foreground">
              → {s.toPost?.site.domain ?? "(deleted)"} / {s.toPost?.title ?? s.anchorText}
            </div>
            <div className="mt-1 text-sm">
              Anchor: <span className="font-mono">{s.anchorText}</span>
            </div>
            <div className="mt-3 flex gap-2">
              <Button
                onClick={() => {
                  void handleDecide(s.id, "approve");
                }}
              >
                Approve
              </Button>
              <Button
                onClick={() => {
                  void handleDecide(s.id, "reject");
                }}
                variant="outline"
              >
                Reject
              </Button>
            </div>
          </li>
        ))}
      </ul>

      {hasNextPage ? (
        <div className="mt-6">
          <Button
            disabled={isFetchingNextPage}
            onClick={() => {
              void fetchNextPage();
            }}
            variant="outline"
          >
            {isFetchingNextPage ? "Loading…" : "Load more"}
          </Button>
        </div>
      ) : null}
    </section>
  );
};

export default SuggestionsPage;
