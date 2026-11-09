import { Button } from "@repo/ui/components/button";

export const LoadError = ({ message, onRetry }: { message: string; onRetry: () => void }) => (
  <div className="flex flex-col items-start gap-3">
    <p className="text-sm text-destructive">{message}</p>
    <Button onClick={onRetry} variant="outline">
      Retry
    </Button>
  </div>
);
