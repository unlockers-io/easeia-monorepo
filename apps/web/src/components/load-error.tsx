import { Button } from "@repo/ui/components/button";

export const LoadError = ({ onRetry, what }: { onRetry: () => void; what: string }) => (
  <div className="flex flex-col items-start gap-3">
    <p className="text-sm text-destructive">
      Failed to load {what}. Check your connection and retry.
    </p>
    <Button onClick={onRetry} variant="outline">
      Retry
    </Button>
  </div>
);
