"use client";

import type { FixAdvice, FixAdviceCategory, FixAdviceSeverity, FixStep } from "@repo/ai";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog";
import { Skeleton } from "@repo/ui/components/skeleton";
import { AlertTriangle, Check, Copy, Loader2, Sparkles, Wand2, XCircle } from "lucide-react";
import { useEffect, useState, useTransition } from "react";

import { BulkAdviceStatus } from "./bulk-advice-status";
import type { BulkState } from "./bulk-advice-status";
import { bulkGenerateFixAdviceAction, getFixAdviceAction } from "./fix-advice-actions";

const VISIBLE_CHECK_LIMIT = 8;

type Props = {
  failing: ReadonlyArray<string>;
  siteId: string;
};

const FailingChecksList = ({ failing, siteId }: Props) => {
  const [active, setActive] = useState<string | null>(null);
  const [bulk, setBulk] = useState<BulkState>({ kind: "idle" });
  const [bulkPending, startBulkTransition] = useTransition();

  const handleClose = () => {
    setActive(null);
  };

  const expanded = bulk.kind === "done";
  const visible = expanded ? failing : failing.slice(0, VISIBLE_CHECK_LIMIT);
  const overflow = expanded ? 0 : failing.length - visible.length;

  const handleGenerateAll = () => {
    setBulk({ kind: "running", total: failing.length });
    startBulkTransition(async () => {
      const result = await bulkGenerateFixAdviceAction({
        checkNames: [...failing],
        siteId,
      });
      if (!result.ok) {
        setBulk({ kind: "error", message: result.error });
        return;
      }
      const ready = new Set(
        result.results.reduce<Array<string>>((acc, r) => {
          if (r.ok) {
            acc.push(r.checkName);
          }
          return acc;
        }, []),
      );
      const failed = result.results.length - ready.size;
      setBulk({
        failedCount: failed,
        kind: "done",
        readyChecks: ready,
        total: result.results.length,
      });
    });
  };

  return (
    <>
      <div className="mt-2 flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {failing.length === 0
            ? "No failing checks."
            : `${failing.length} failing check${failing.length === 1 ? "" : "s"}`}
        </p>
        {failing.length > 0 ? (
          <Button
            disabled={bulkPending || bulk.kind === "done"}
            onClick={handleGenerateAll}
            size="sm"
            type="button"
            variant="outline"
          >
            {bulkPending ? (
              <Loader2 aria-hidden="true" className="size-3.5 motion-safe:animate-spin" />
            ) : (
              <Sparkles aria-hidden="true" className="size-3.5" />
            )}
            {bulk.kind === "done" ? "Advice ready" : `Generate all (${failing.length})`}
          </Button>
        ) : null}
      </div>

      <BulkAdviceStatus bulk={bulk} />

      <ul className="mt-2 flex max-h-112 flex-col gap-1 overflow-y-auto text-xs">
        {visible.map((name) => {
          const ready = bulk.kind === "done" && bulk.readyChecks.has(name);
          return (
            <li key={name}>
              <button
                className="-mx-1 flex w-full items-baseline gap-2 rounded-md px-1 py-0.5 text-left transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                onClick={() => {
                  setActive(name);
                }}
                type="button"
              >
                <XCircle aria-hidden="true" className="size-3 h-lh shrink-0 text-destructive" />
                <code className="flex-1 text-xs">{name}</code>
                <span
                  className={`inline-flex items-center gap-1 text-xs ${ready ? "text-primary" : "text-muted-foreground"}`}
                >
                  <Sparkles aria-hidden="true" className="size-3" />
                  {ready ? "Ready" : "Get AI fix"}
                </span>
              </button>
            </li>
          );
        })}
        {overflow > 0 ? (
          <li className="text-muted-foreground">+{overflow} more failing checks</li>
        ) : null}
      </ul>

      <FixAdviceDialog checkName={active} onClose={handleClose} siteId={siteId} />
    </>
  );
};

type DialogProps = {
  checkName: string | null;
  onClose: () => void;
  siteId: string;
};

type Phase =
  | { kind: "idle" }
  | { checkName: string; kind: "loading" }
  | { advice: FixAdvice; checkName: string; kind: "ready" }
  | { checkName: string; kind: "error"; message: string };

const FixAdviceDialog = ({ checkName, onClose, siteId }: DialogProps) => {
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [, startTransition] = useTransition();

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      onClose();
      setPhase({ kind: "idle" });
    }
  };

  useEffect(() => {
    if (checkName === null || checkName === "") {
      return undefined;
    }

    let cancelled = false;
    startTransition(async () => {
      const result = await getFixAdviceAction({ checkName, siteId });
      if (cancelled) {
        return;
      }
      if (!result.ok) {
        setPhase({ checkName, kind: "error", message: result.error });
        return;
      }
      setPhase({ advice: result.data, checkName, kind: "ready" });
    });

    return () => {
      cancelled = true;
    };
  }, [checkName, siteId, startTransition]);

  const open = checkName !== null;
  const visiblePhase: Phase =
    checkName !== null &&
    checkName !== "" &&
    (phase.kind === "idle" || phase.checkName !== checkName)
      ? { checkName, kind: "loading" }
      : phase;

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles aria-hidden="true" className="size-4 text-primary" />
            AI fix advice
          </DialogTitle>
          <DialogDescription>
            {checkName !== null && checkName !== "" ? (
              <>
                Failing check: <code className="text-foreground">{checkName}</code>
              </>
            ) : (
              "Pick a failing check to see context-aware fix steps."
            )}
          </DialogDescription>
        </DialogHeader>

        {visiblePhase.kind === "loading" ? <LoadingState /> : null}
        {visiblePhase.kind === "error" ? <ErrorState message={visiblePhase.message} /> : null}
        {visiblePhase.kind === "ready" ? <AdviceView advice={visiblePhase.advice} /> : null}

        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>Close</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const LoadingState = () => (
  <div aria-live="polite" className="flex flex-col gap-3 py-2">
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="size-4 motion-safe:animate-spin" />
      Asking the model for a fix recipe…
    </div>
    <Skeleton className="h-4 w-3/4" />
    <Skeleton className="h-4 w-2/3" />
    <Skeleton className="h-20 w-full" />
  </div>
);

const ErrorState = ({ message }: { message: string }) => (
  <div aria-live="polite" className="flex items-start gap-2 rounded-md bg-destructive/10 p-3">
    <AlertTriangle aria-hidden="true" className="size-4 h-lh shrink-0 text-destructive" />
    <p className="text-sm text-destructive">{message}</p>
  </div>
);

const AdviceView = ({ advice }: { advice: FixAdvice }) => (
  <div className="flex flex-col gap-4">
    <div className="flex flex-wrap items-center gap-2">
      <SeverityBadge severity={advice.severity} />
      <CategoryBadge category={advice.category} />
      {advice.autoApplyable ? (
        <Badge variant="secondary">
          <Wand2 aria-hidden="true" className="size-3" />
          Auto-applyable
        </Badge>
      ) : (
        <Badge variant="outline">Manual fix</Badge>
      )}
    </div>

    <section className="flex flex-col gap-1">
      <h3 className="text-xs font-medium text-muted-foreground">What this means</h3>
      <p className="text-sm leading-relaxed">{advice.problem}</p>
    </section>

    <section className="flex flex-col gap-2">
      <h3 className="text-xs font-medium text-muted-foreground">Steps to fix</h3>
      <ol className="flex flex-col gap-3 text-sm">
        {advice.steps.map((step, idx) => (
          <StepRow index={idx + 1} key={step.description} step={step} />
        ))}
      </ol>
    </section>
  </div>
);

const StepRow = ({ index, step }: { index: number; step: FixStep }) => (
  <li className="flex flex-col gap-2 rounded-md border border-border/60 p-3">
    <div className="flex items-start gap-2">
      <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium tabular-nums">
        {index}
      </span>
      <p className="flex-1 text-sm">{step.description}</p>
      <Badge variant={step.manual ? "outline" : "secondary"}>
        {step.manual ? "Manual" : "WP REST"}
      </Badge>
    </div>
    {step.snippet !== null && step.snippet !== "" ? <SnippetBlock snippet={step.snippet} /> : null}
  </li>
);

const SnippetBlock = ({ snippet }: { snippet: string }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
      }, 1500);
    } catch {
      setCopied(false);
    }
  };
  return (
    <div className="relative">
      <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs whitespace-pre-wrap">
        {snippet}
      </pre>
      <Button
        aria-label="Copy snippet"
        className="absolute top-1.5 right-1.5"
        onClick={() => {
          void handleCopy();
        }}
        size="icon-sm"
        type="button"
        variant="ghost"
      >
        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      </Button>
    </div>
  );
};

const SEVERITY_LABEL = {
  high: "High severity",
  low: "Low severity",
  medium: "Medium severity",
} satisfies Record<FixAdviceSeverity, string>;

const SeverityBadge = ({ severity }: { severity: FixAdviceSeverity }) => {
  if (severity === "high") {
    return <Badge variant="destructive">{SEVERITY_LABEL[severity]}</Badge>;
  }
  if (severity === "medium") {
    return <Badge variant="secondary">{SEVERITY_LABEL[severity]}</Badge>;
  }
  return <Badge variant="outline">{SEVERITY_LABEL[severity]}</Badge>;
};

const CATEGORY_LABEL = {
  content: "Content",
  hosting: "Hosting",
  structure: "Structure",
  wordpress: "WordPress",
} satisfies Record<FixAdviceCategory, string>;

const CategoryBadge = ({ category }: { category: FixAdviceCategory }) => (
  <Badge variant="outline">{CATEGORY_LABEL[category]}</Badge>
);

export { FailingChecksList };
