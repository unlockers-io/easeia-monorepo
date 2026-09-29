"use client";
import { Button } from "@repo/ui/components/button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";

import { listSuggestionsAction, decideSuggestionAction } from "@/app/dashboard/network/actions";
import { unwrapAction } from "@/lib/action-result";

const postRefSchema = z.object({
  id: z.string(),
  site: z.object({ domain: z.string() }),
  slug: z.string(),
  title: z.string(),
});

const itemSchema = z.object({
  anchorText: z.string(),
  id: z.string(),
  toPost: postRefSchema.nullable(),
  type: z.enum(["INTERNAL", "PBN", "EXTERNAL"]),
});

const itemsPayloadSchema = z.object({ data: z.array(itemSchema) });

type Item = z.infer<typeof itemSchema>;

const fetchSuggestions = async (postId: string): Promise<Array<Item>> =>
  itemsPayloadSchema.parse(
    unwrapAction(await listSuggestionsAction({ fromPostId: postId, limit: 20 })),
  ).data;
const decideSuggestion = async (id: string, action: "approve" | "reject"): Promise<void> => {
  unwrapAction(await decideSuggestionAction(id, action));
};

export const SuggestedLinksPanel = ({ postId }: { postId: string }) => {
  const queryClient = useQueryClient();
  const queryKey = ["suggestions", postId] as const;

  const {
    data: items = [],
    isError,
    isPending,
    refetch,
  } = useQuery({
    queryFn: () => fetchSuggestions(postId),
    queryKey,
  });

  const { mutate: decide } = useMutation({
    mutationFn: ({ action, id }: { action: "approve" | "reject"; id: string }) =>
      decideSuggestion(id, action),
    onError: (_err, { action }) => {
      toast.error(`Failed to ${action} suggestion. Please try again.`);
    },
    onSuccess: (_data, { id }) => {
      queryClient.setQueryData<Array<Item>>(queryKey, (prev) =>
        prev ? prev.filter((i) => i.id !== id) : [],
      );
    },
  });

  if (isPending) {
    return <p className="text-sm text-muted-foreground">Loading suggestions…</p>;
  }
  if (isError) {
    return (
      <div role="alert">
        <p>Could not load suggested links.</p>
        <Button
          onClick={() => {
            void refetch();
          }}
          size="sm"
          variant="outline"
        >
          Try again
        </Button>
      </div>
    );
  }
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">No pending suggestions.</p>;
  }

  return (
    <ul className="space-y-2">
      {items.map((s) => (
        <li className="flex items-center justify-between rounded border p-2" key={s.id}>
          <div>
            <div className="text-xs text-muted-foreground">{s.type}</div>
            <div className="text-sm">
              {s.toPost?.title ?? "(missing target)"} ·{" "}
              <span className="text-muted-foreground">{s.toPost?.site.domain ?? ""}</span>
            </div>
            <div className="font-mono text-xs">{s.anchorText}</div>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => {
                decide({ action: "approve", id: s.id });
              }}
              size="sm"
            >
              Approve
            </Button>
            <Button
              onClick={() => {
                decide({ action: "reject", id: s.id });
              }}
              size="sm"
              variant="outline"
            >
              Reject
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
};
