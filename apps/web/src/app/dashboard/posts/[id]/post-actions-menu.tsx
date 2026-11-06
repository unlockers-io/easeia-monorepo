"use client";

import { Button } from "@repo/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import { useClientReady } from "@repo/ui/hooks/use-client-ready";
import { ExternalLink, MoreHorizontal, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { deletePostAction } from "../actions";

type Props = {
  domain: string;
  postId: string;
  publicPageUrl: string;
};

const PostActionsMenu = ({ domain, postId, publicPageUrl }: Props) => {
  const ready = useClientReady();
  const { push } = useRouter();

  const handleDelete = async () => {
    const result = await deletePostAction(postId);

    if (!result.ok) {
      toast.error(result.error);

      return;
    }

    push("/dashboard/posts");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={!ready}
        render={
          <Button aria-label="Post actions" size="icon" variant="outline">
            <MoreHorizontal className="size-4" />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-max max-w-(--available-width)">
        <DropdownMenuItem
          render={
            <a href={publicPageUrl} rel="noreferrer" target="_blank">
              <ExternalLink className="size-4" />
              View on {domain}
            </a>
          }
        />
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {
            void handleDelete();
          }}
          variant="destructive"
        >
          <Trash2 className="size-4" />
          Delete post
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export { PostActionsMenu };
