import Link from "next/link";
import type { ReactNode } from "react";

const TABS = [
  ["/dashboard/network", "Link graph"],
  ["/dashboard/network/backfill", "Backfill"],
  ["/dashboard/network/rewrite", "Rewrite"],
  ["/dashboard/network/suggestions", "Suggestions"],
] as const;
const Layout = ({ children }: { children: ReactNode }) => (
  <div className="flex flex-col gap-6">
    <nav aria-label="Network tools" className="flex flex-wrap gap-4 border-b pb-3">
      {TABS.map(([href, title]) => (
        <Link className="text-sm underline-offset-4 hover:underline" href={href} key={href}>
          {title}
        </Link>
      ))}
    </nav>
    {children}
  </div>
);
export default Layout;
