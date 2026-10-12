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

import { deletePostAction } from "../../actions";

type Props = {
  domain: string;
  postId: string;
  publicPageUrl: string;
};

const PostActionsMenu = ({ domain, postId, publicPageUrl }: Props) => {
  const ready = useClientReady();

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
            // eslint-disable-next-line jsx-a11y/control-has-associated-label, react-doctor/control-has-associated-label -- base-ui forwards the menu item children into the rendered anchor
            <a href={publicPageUrl} rel="noreferrer" target="_blank" />
          }
        >
          <ExternalLink className="size-4" />
          View on {domain}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <form action={deletePostAction}>
          <input name="id" type="hidden" value={postId} />
          <DropdownMenuItem
            render={
              // eslint-disable-next-line jsx-a11y/control-has-associated-label -- base-ui forwards the menu item children into the rendered button
              <button className="w-full" type="submit" />
            }
            variant="destructive"
          >
            <Trash2 className="size-4" />
            Delete post
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export { PostActionsMenu };
