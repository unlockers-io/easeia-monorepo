import * as Sites from "@repo/sites";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import { connection } from "next/server";

import { SiteCreateDialog } from "@/components/site-create-dialog";

import { NewPostForm } from "./new-post-form";

const NewPostPage = async () => {
  await connection();

  const sites = await Sites.listEnabled();

  if (sites.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Add a site first</h2>
          </CardTitle>
          <CardDescription>
            Create an enabled Astro site before writing your first post.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SiteCreateDialog />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">New post</h1>
        <p className="text-sm text-muted-foreground">
          Write your post in Markdown. Save a draft or publish to Astro when your site has a deploy
          hook.
        </p>
      </header>

      <NewPostForm sites={sites} />
    </div>
  );
};

export default NewPostPage;
