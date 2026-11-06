import { Skeleton } from "@repo/ui/components/skeleton";
import { Logo } from "@repo/ui/compositions/logo";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense, type ReactNode } from "react";

import { getSession } from "@/lib/auth-helpers";

import DashboardContentSkeleton from "./loading";
import { NavLink } from "./nav-link";
import { SignOutButton } from "./sign-out-button";

const SessionEmail = async () => {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  return (
    <p className="text-xs break-all text-muted-foreground" title={session.user.email}>
      {session.user.email}
    </p>
  );
};

const NAV = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/sites", label: "Sites" },
  { href: "/dashboard/network", label: "Network" },
  { href: "/dashboard/posts", label: "Posts" },
  { href: "/dashboard/buckets", label: "Buckets" },
  { href: "/dashboard/jobs", label: "Jobs" },
  { href: "/dashboard/api-keys", label: "API Keys" },
  { href: "/dashboard/money-sites", label: "Money sites" },
  { href: "/dashboard/settings", label: "Settings" },
];

const AuthGate = async ({ children }: { children: ReactNode }) => {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  return children;
};

const Layout = ({ children }: { children: ReactNode }) => {
  return (
    <div className="mx-auto grid min-h-svh max-w-370 grid-cols-1 bg-background text-foreground antialiased md:grid-cols-dashboard-nav">
      <aside
        aria-label="Dashboard navigation"
        className="flex min-w-0 flex-col border-b border-foreground max-md:gap-2 max-md:px-4 max-md:py-3 md:sticky md:top-0 md:h-svh md:border-r md:border-b-0 md:py-6 md:pr-6 md:pl-8"
      >
        <div className="flex items-center justify-between gap-4 md:block md:border-b-4 md:border-foreground md:pb-5">
          <Link aria-label="Easeia dashboard" className="inline-flex" href="/dashboard">
            <Logo className="text-xl" />
          </Link>
          <Link
            className="inline-flex min-h-9 items-center bg-primary px-3 text-sm font-bold text-primary-foreground hover:bg-primary/85 md:hidden"
            href="/dashboard/posts/new"
          >
            New post
          </Link>
        </div>
        <nav
          aria-label="Sections"
          className="flex gap-1 overflow-x-auto max-md:-mx-4 max-md:px-2 md:mt-2 md:flex-col md:gap-0 md:overflow-visible"
        >
          {NAV.map((item, index) => (
            <NavLink href={item.href} index={String(index).padStart(2, "0")} key={item.href}>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto hidden flex-col gap-3 md:flex">
          <div className="flex flex-col items-start gap-2 border-t border-border pt-3">
            <Suspense fallback={<Skeleton className="h-4 w-28" />}>
              <SessionEmail />
            </Suspense>
            <SignOutButton />
          </div>
          <Link
            className="flex min-h-11 items-center justify-center bg-primary px-4 text-sm font-bold text-primary-foreground hover:bg-primary/85"
            href="/dashboard/posts/new"
          >
            New post
          </Link>
        </div>
      </aside>
      <main className="isolate min-w-0 px-4 py-6 md:px-10 md:py-6" id="main-content" tabIndex={-1}>
        <Suspense fallback={<DashboardContentSkeleton />}>
          <AuthGate>{children}</AuthGate>
        </Suspense>
      </main>
    </div>
  );
};

export default Layout;
