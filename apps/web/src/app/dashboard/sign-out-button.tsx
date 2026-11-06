"use client";

import { Button } from "@repo/ui/components/button";
import { useClientReady } from "@repo/ui/hooks/use-client-ready";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { authClient, runAuth } from "@/lib/auth-client";

const SignOutButton = () => {
  const { push } = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const ready = useClientReady();

  const handleSignOut = async () => {
    setIsLoading(true);
    const result = await runAuth(authClient.signOut(), "Failed to sign out. Please try again.");

    if (!result.ok) {
      setIsLoading(false);
      toast.error(result.error);

      return;
    }

    push("/login");
  };

  return (
    <Button
      disabled={!ready || isLoading}
      onClick={() => {
        void handleSignOut();
      }}
      size="sm"
      variant="ghost"
    >
      {isLoading && <Loader2 className="size-4 motion-safe:animate-spin" />}
      {isLoading ? "Signing out" : "Sign out"}
    </Button>
  );
};

export { SignOutButton };
