"use client";

import { cn } from "@repo/ui/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  href: string;
  /** Two-digit section number, printed in the rail like a report's contents. */
  index?: string;
};

const BASE_CLASS =
  "flex min-h-11 shrink-0 items-center gap-3 text-sm whitespace-nowrap transition-colors max-md:px-2 md:min-h-0 md:border-b md:border-border md:py-2.5";
const INACTIVE_CLASS = cn(BASE_CLASS, "font-medium text-muted-foreground hover:text-foreground");
const ACTIVE_CLASS = cn(
  BASE_CLASS,
  "font-bold text-foreground max-md:shadow-(--shadow-nav-active)",
);

const Index = ({ active, value }: { active: boolean; value: string | undefined }) => {
  if (value === undefined) {
    return null;
  }
  return (
    <span
      aria-hidden="true"
      className={cn(
        "w-5 text-xs tabular-nums max-md:hidden",
        active ? "text-foreground" : "text-muted-foreground",
      )}
    >
      {value}
    </span>
  );
};

const ActiveAwareLink = ({ children, href, index }: Props) => {
  const pathname = usePathname();
  const isActive = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));

  return (
    <Link
      aria-current={isActive ? "page" : undefined}
      className={isActive ? ACTIVE_CLASS : INACTIVE_CLASS}
      href={href}
    >
      <Index active={isActive} value={index} />
      {children}
    </Link>
  );
};

const NavLink = ({ children, href, index }: Props) => (
  <Suspense
    fallback={
      <Link className={INACTIVE_CLASS} href={href}>
        <Index active={false} value={index} />
        {children}
      </Link>
    }
  >
    <ActiveAwareLink href={href} index={index}>
      {children}
    </ActiveAwareLink>
  </Suspense>
);

export { NavLink };
