"use client";

import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Checkbox } from "@repo/ui/components/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@repo/ui/components/dialog";
import { Field, FieldGroup, FieldLabel } from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";
import { Check, Copy, KeyRound, Plus } from "lucide-react";
import { useReducer, useTransition } from "react";
import { toast } from "sonner";

import { createApiKeyAction } from "./actions";

type Props = {
  scopes: ReadonlyArray<string>;
  sites: ReadonlyArray<{ domain: string; id: string }>;
  siteScopedScopes: ReadonlyArray<string>;
};

type CreateKeyState = {
  copied: boolean;
  error: string | undefined;
  name: string;
  open: boolean;
  picked: ReadonlySet<string>;
  siteId: string;
  token: string | undefined;
};

type CreateKeyAction =
  | { type: "copied.set"; value: boolean }
  | { type: "create.error"; value: string }
  | { type: "create.success"; value: string }
  | { type: "name.set"; value: string }
  | { type: "open.set"; value: boolean }
  | { type: "pick.toggle"; value: string }
  | { type: "site.set"; value: string };

const createInitialState = (): CreateKeyState => ({
  copied: false,
  error: undefined,
  name: "",
  open: false,
  picked: new Set(),
  siteId: "",
  token: undefined,
});

const createKeyReducer = (state: CreateKeyState, action: CreateKeyAction): CreateKeyState => {
  switch (action.type) {
    case "copied.set": {
      return { ...state, copied: action.value };
    }
    case "create.error": {
      return { ...state, error: action.value };
    }
    case "create.success": {
      return { ...state, error: undefined, token: action.value };
    }
    case "name.set": {
      return { ...state, name: action.value };
    }
    case "open.set": {
      return action.value ? { ...state, open: true } : createInitialState();
    }
    case "pick.toggle": {
      const picked = new Set(state.picked);
      if (picked.has(action.value)) {
        picked.delete(action.value);
      } else {
        picked.add(action.value);
      }
      return { ...state, picked };
    }
    case "site.set": {
      return { ...state, siteId: action.value };
    }
    default: {
      return state;
    }
  }
};

const CreateKeyDialog = ({ scopes, sites, siteScopedScopes }: Props) => {
  const [state, dispatch] = useReducer(createKeyReducer, undefined, createInitialState);
  const [pending, startTransition] = useTransition();
  const { copied, error, name, open, picked, siteId, token } = state;

  const needsSite = siteScopedScopes.some((scope) => picked.has(scope));

  const handleOpenChange = (next: boolean) => {
    dispatch({ type: "open.set", value: next });
  };

  const handleTogglePick = (scope: string) => {
    dispatch({ type: "pick.toggle", value: scope });
  };

  const handleCreate = () => {
    const fd = new FormData();
    fd.set("name", name);
    for (const s of picked) {
      fd.append("scopes", s);
    }
    if (needsSite && siteId !== "") {
      fd.set("siteId", siteId);
    }
    startTransition(async () => {
      const result = await createApiKeyAction(fd);
      if (result.error !== undefined) {
        dispatch({ type: "create.error", value: result.error });
        return;
      }
      dispatch({ type: "create.success", value: result.token });
    });
  };

  const handleCopy = async () => {
    if (token === undefined || token === "") {
      return;
    }
    try {
      await navigator.clipboard.writeText(token);
      dispatch({ type: "copied.set", value: true });
      setTimeout(() => {
        dispatch({ type: "copied.set", value: false });
      }, 2000);
    } catch {
      toast.error("Copy failed. Select the token below and copy it manually.");
    }
  };

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogTrigger
        render={
          <Button>
            <Plus className="size-4" />
            New key
          </Button>
        }
      />

      <DialogContent className="sm:max-w-lg">
        {token !== undefined && token !== "" ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <KeyRound className="size-4 text-primary" />
                Token issued
              </DialogTitle>
              <DialogDescription>
                Copy it now. You won&apos;t be able to read it again.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-2">
              <code className="block rounded-md border border-border bg-muted p-3 font-mono text-xs break-all">
                {token}
              </code>
              <Button
                onClick={() => {
                  void handleCopy();
                }}
                type="button"
                variant="outline"
              >
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                {copied ? "Copied" : "Copy to clipboard"}
              </Button>
            </div>
            <DialogFooter>
              <DialogClose render={<Button type="button" />}>Done</DialogClose>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Create API key</DialogTitle>
              <DialogDescription>
                Pick scopes carefully. Keys can&apos;t be edited after creation, only revoked.
              </DialogDescription>
            </DialogHeader>

            <FieldGroup className="gap-4 py-2">
              <Field>
                <FieldLabel htmlFor="name">Name</FieldLabel>
                <Input
                  id="name"
                  onChange={(e) => {
                    dispatch({ type: "name.set", value: e.target.value });
                  }}
                  placeholder="N8N integration"
                  value={name}
                />
              </Field>

              <Field>
                <FieldLabel>Scopes</FieldLabel>
                <div className="flex flex-wrap gap-2">
                  {scopes.map((s) => {
                    const active = picked.has(s);
                    return (
                      <button
                        aria-pressed={active}
                        className="contents"
                        key={s}
                        onClick={() => {
                          handleTogglePick(s);
                        }}
                        type="button"
                      >
                        <Badge
                          className="cursor-pointer select-none"
                          variant={active ? "default" : "outline"}
                        >
                          <Checkbox
                            checked={active}
                            className="pointer-events-none"
                            tabIndex={-1}
                          />
                          {s}
                        </Badge>
                      </button>
                    );
                  })}
                </div>
              </Field>

              {needsSite &&
                (sites.length === 0 ? (
                  <p className="text-sm text-destructive">
                    {siteScopedScopes.join(", ")} keys are restricted to one site, and no enabled
                    site exists yet. Enable a site first.
                  </p>
                ) : (
                  <Field>
                    <FieldLabel htmlFor="siteId">Site</FieldLabel>
                    <Select
                      onValueChange={(next: string | null) => {
                        dispatch({ type: "site.set", value: next ?? "" });
                      }}
                      value={siteId}
                    >
                      <SelectTrigger className="w-full" id="siteId">
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
                    <p className="text-xs text-muted-foreground">
                      Required: {siteScopedScopes.join(", ")} keys only work against the site they
                      are bound to.
                    </p>
                  </Field>
                ))}

              {error !== undefined && error !== "" && (
                <p className="text-sm text-destructive">{error}</p>
              )}
            </FieldGroup>

            <DialogFooter>
              <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
              <Button
                disabled={pending || !name || picked.size === 0 || (needsSite && siteId === "")}
                onClick={handleCreate}
                type="button"
              >
                {pending ? "Creating…" : "Create"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export { CreateKeyDialog };
