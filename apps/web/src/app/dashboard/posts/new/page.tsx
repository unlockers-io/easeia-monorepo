import { Niche, prisma } from "@repo/db";
import { Button } from "@repo/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import { Field, FieldGroup, FieldLabel } from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";
import { Switch } from "@repo/ui/components/switch";
import { Textarea } from "@repo/ui/components/textarea";

import { createPostAction } from "../../actions";
import { SiteCreateDialog } from "../../sites/site-create-dialog";

import { NicheSelector } from "./niche-selector";

const NICHE_OPTIONS = Object.values(Niche);

const NewPostPage = async () => {
  const sites = await prisma.site.findMany({
    orderBy: { domain: "asc" },
    where: { isEnabled: true },
  });

  const [firstSite] = sites;
  if (firstSite === undefined) {
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

      <form action={createPostAction} className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>
              <h2>Target & content</h2>
            </CardTitle>
            <CardDescription>Where to publish, and what to publish.</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup className="gap-5">
              <Field>
                <FieldLabel htmlFor="siteId">Site</FieldLabel>
                <Select defaultValue={firstSite.id} name="siteId">
                  <SelectTrigger id="siteId">
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
              </Field>

              <div className="grid gap-5 sm:grid-cols-post-editor">
                <Field>
                  <FieldLabel htmlFor="slug">Slug</FieldLabel>
                  <Input
                    id="slug"
                    name="slug"
                    pattern="^[a-z0-9]+(?:-[a-z0-9]+)*$"
                    placeholder="kebab-case-only"
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="title">Title</FieldLabel>
                  <Input id="title" name="title" required />
                </Field>
              </div>

              <Field>
                <FieldLabel htmlFor="body">Body (Markdown)</FieldLabel>
                <div className="font-mono">
                  <Textarea
                    id="body"
                    name="body"
                    placeholder={"## Introduction\n\nWrite your post here…"}
                    required
                  />
                </div>
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              <h2>SEO tracking</h2>
            </CardTitle>
            <CardDescription>
              Focus keyword feeds DataForSEO SERP rank tracking. Meta title/description are managed
              by your Astro site templates.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup className="gap-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="focusKeyword">Focus keyword</FieldLabel>
                  <Input id="focusKeyword" name="focusKeyword" placeholder="wedding photography" />
                </Field>
                <Field>
                  <FieldLabel htmlFor="excerpt">Excerpt</FieldLabel>
                  <Input id="excerpt" maxLength={300} name="excerpt" placeholder="Short summary" />
                </Field>
              </div>
            </FieldGroup>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              <h2>Taxonomy</h2>
            </CardTitle>
            <CardDescription>
              Categories and tags map per site. Niches drive cross-site link relevance.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup className="gap-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="categories">Categories</FieldLabel>
                  <Input id="categories" name="categories" placeholder="Photography, Wedding" />
                </Field>
                <Field>
                  <FieldLabel htmlFor="tags">Tags</FieldLabel>
                  <Input id="tags" name="tags" placeholder="weddings, portraits" />
                </Field>
              </div>
              <Field>
                <FieldLabel>Niches</FieldLabel>
                <NicheSelector niches={NICHE_OPTIONS} />
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              <h2>Publish</h2>
            </CardTitle>
            <CardDescription>
              Drafts stay in Easeia. Publishing pushes to Astro now, or at the scheduled time.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup className="gap-5">
              <div className="flex items-center justify-between rounded-lg border border-border p-4">
                <div>
                  <FieldLabel htmlFor="publish">Publish now / on schedule</FieldLabel>
                  <p className="text-xs text-muted-foreground">
                    Skips Drafts; goes straight to Scheduled, then the worker pushes.
                  </p>
                </div>
                <Switch id="publish" name="publish" value="on" />
              </div>
              <Field>
                <FieldLabel htmlFor="scheduledAt">Scheduled at (optional)</FieldLabel>
                <Input id="scheduledAt" name="scheduledAt" type="datetime-local" />
                <p className="text-xs text-muted-foreground">
                  Leave empty to publish immediately. Future timestamps queue with delay.
                </p>
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>

        <div className="flex items-center justify-end gap-2">
          <Button type="submit">Save</Button>
        </div>
      </form>
    </div>
  );
};

export default NewPostPage;
