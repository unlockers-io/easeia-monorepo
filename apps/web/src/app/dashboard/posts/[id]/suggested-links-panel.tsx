"use client";

import { Button } from "@repo/ui/components/button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { decideSuggestionAction, listSuggestionsAction } from "@/app/dashboard/network/actions";
import { unwrapAction } from "@/lib/action-result";

const fetchSuggestions = async (postId: string) =>
  unwrapAction(await listSuggestionsAction({ fromPostId: postId, limit: 20 })).data;

type Item = Awaited<ReturnType<typeof fetchSuggestions>>[number];

const decideSuggestion = async (id: string, action: "approve" | "reject") =>
  unwrapAction(await decideSuggestionAction(id, action));

export const SuggestedLinksPanel = ({ postId }: { postId: string }) => {
  const queryClient = useQueryClient();
  const queryKey = ["suggestions", postId] as const;

  const {
    data: items = [],
    error,
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
    onError: (decideError) => {
      toast.error(decideError.message);
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
        <p>{error.message}</p>
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
