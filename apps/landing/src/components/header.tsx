import { buttonVariants } from "@repo/ui/components/button";
import { cn } from "@repo/ui/lib/utils";
import { Menu } from "lucide-react";
import Link from "next/link";

import { GITHUB_URL, webAppUrl } from "@/lib/urls";

import { Logo } from "./logo";

const NAV = [
  { href: GITHUB_URL, label: "GitHub" },
  { href: "/#capabilities", label: "Capabilities" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#api", label: "API" },
  { href: "/#pricing", label: "Pricing" },
];

const Header = () => {
  return (
    <header className="sticky top-0 z-10 border-b-4 border-foreground bg-background">
      <div className="mx-auto flex max-w-(--breakpoint-xl) items-center gap-7 px-6 py-4 md:px-8">
        <Link aria-label="Homepage" href="/">
          <Logo className="text-xl" />
        </Link>
        <nav
          aria-label="Main"
          className="ml-auto hidden items-center gap-4 text-sm font-semibold text-muted-foreground md:flex"
        >
          {NAV.map((item) => (
            <Link
              className="hover:text-foreground hover:underline hover:underline-offset-4"
              href={item.href}
              key={item.href}
            >
              {item.label}
            </Link>
          ))}
          <a
            className="hover:text-foreground hover:underline hover:underline-offset-4"
            href={webAppUrl("/login")}
          >
            Sign in
          </a>
          <Link className={cn(buttonVariants({ size: "lg" }))} href="/#waitlist">
            Waitlist
          </Link>
        </nav>
        <details className="group relative ml-auto md:hidden">
          <summary className="flex size-11 list-none items-center justify-center border border-foreground bg-background marker:content-none">
            <Menu aria-hidden="true" />
            <span className="sr-only">Open navigation</span>
          </summary>
          <nav
            aria-label="Mobile"
            className="absolute top-13 right-0 grid min-w-52 border border-foreground bg-background p-2 font-semibold"
          >
            {NAV.map((item) => (
              <Link className="px-3 py-2 hover:bg-muted" href={item.href} key={item.href}>
                {item.label}
              </Link>
            ))}
            <a className="px-3 py-2 hover:bg-muted" href={webAppUrl("/login")}>
              Sign in
            </a>
            <Link className="px-3 py-2 hover:bg-muted" href="/#waitlist">
              Waitlist
            </Link>
          </nav>
        </details>
      </div>
    </header>
  );
};

export { Header };
