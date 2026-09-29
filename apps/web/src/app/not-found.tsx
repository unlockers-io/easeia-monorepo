import { buttonVariants } from "@repo/ui/components/button";
import { Logo } from "@repo/ui/compositions/logo";
import { cn } from "@repo/ui/lib/utils";
import type { Metadata } from "next";
import Link from "next/link";

/** @public Next.js app-router reads metadata via the module loader */
export const metadata: Metadata = {
  title: "Page not found",
};

const NotFound = () => (
  <main
    className="flex min-h-svh flex-col items-center justify-center gap-8 bg-muted p-6 text-center md:p-10"
    id="main-content"
  >
    <Link aria-label="Easeia" href="/dashboard">
      <Logo className="text-xl" />
    </Link>
    <div className="flex flex-col gap-2">
      <p className="text-8xl font-bold tracking-tight text-foreground">404</p>
      <h1 className="text-2xl font-semibold text-foreground">Page not found</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        The page you&rsquo;re looking for doesn&rsquo;t exist or has been moved.
      </p>
    </div>
    <Link className={cn(buttonVariants())} href="/dashboard">
      Go to dashboard
    </Link>
  </main>
);

export default NotFound;
