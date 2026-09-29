"use client";

import { Button } from "@repo/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import { Input } from "@repo/ui/components/input";
import { Textarea } from "@repo/ui/components/textarea";
import { useState, useTransition } from "react";

import { updateSiteAuthorAction } from "./actions";

export type AuthorFormProps = {
  defaultBio: string | null;
  defaultName: string | null;
  defaultPhotoUrl: string | null;
  defaultUrl: string | null;
  siteId: string;
};

export const AuthorCard = (props: AuthorFormProps) => (
  <Card>
    <CardHeader>
      <CardTitle>
        <h2>Author</h2>
      </CardTitle>
      <CardDescription>
        E-E-A-T identity for this site. The build API attaches it to every post so the theme can
        render a byline, author page, and schema.org Person markup.
      </CardDescription>
    </CardHeader>
    <CardContent>
      <AuthorForm {...props} />
    </CardContent>
  </Card>
);

const AuthorForm = (props: AuthorFormProps) => {
  const { siteId } = props;
  const [name, setName] = useState(props.defaultName ?? "");
  const [bio, setBio] = useState(props.defaultBio ?? "");
  const [photoUrl, setPhotoUrl] = useState(props.defaultPhotoUrl ?? "");
  const [url, setUrl] = useState(props.defaultUrl ?? "");
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [pending, startTransition] = useTransition();

  const handleSave = () => {
    startTransition(async () => {
      await updateSiteAuthorAction(siteId, { bio, name, photoUrl, url });
      setSavedAt(new Date());
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium" htmlFor={`author-name-${siteId}`}>
            Name
          </label>
          <Input
            id={`author-name-${siteId}`}
            onChange={(e) => {
              setName(e.target.value);
            }}
            placeholder="e.g. Marina Duarte"
            value={name}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium" htmlFor={`author-url-${siteId}`}>
            Profile URL
          </label>
          <Input
            id={`author-url-${siteId}`}
            onChange={(e) => {
              setUrl(e.target.value);
            }}
            placeholder="https://instagram.com/…"
            type="url"
            value={url}
          />
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium" htmlFor={`author-photo-${siteId}`}>
          Photo URL
        </label>
        <Input
          id={`author-photo-${siteId}`}
          onChange={(e) => {
            setPhotoUrl(e.target.value);
          }}
          placeholder="https://img.easeia.com/…"
          type="url"
          value={photoUrl}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium" htmlFor={`author-bio-${siteId}`}>
          Bio
        </label>
        <Textarea
          id={`author-bio-${siteId}`}
          onChange={(e) => {
            setBio(e.target.value);
          }}
          placeholder="One or two sentences of niche-relevant credentials."
          rows={3}
          value={bio}
        />
      </div>
      <div className="flex items-center justify-between gap-3">
        <p aria-live="polite" className="text-xs text-muted-foreground">
          {savedAt
            ? `Saved ${savedAt.toLocaleTimeString("en-US")}. Changes reach the live site on its next build.`
            : "Leave the name blank to publish posts without a byline."}
        </p>
        <Button disabled={pending} onClick={handleSave} size="sm" type="button">
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
};
