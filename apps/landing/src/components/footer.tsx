import Link from "next/link";

import { apiUrl, DOCS_URL, GITHUB_URL, webAppUrl } from "@/lib/urls";

import { Logo } from "./logo";

const LINKS = [
  { href: GITHUB_URL, label: "GitHub" },
  { href: apiUrl("/docs"), label: "Docs" },
  { href: DOCS_URL, label: "Self-hosting guide" },
  { href: "/#waitlist", label: "Waitlist" },
  { href: webAppUrl("/login"), label: "Sign in" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "mailto:hello@easeia.com", label: "hello@easeia.com" },
];
const Footer = () => (
  <footer className="border-t-4 border-foreground">
    <div className="mx-auto grid max-w-(--breakpoint-xl) gap-10 px-6 py-12 md:grid-cols-content-action md:px-8">
      <div className="flex flex-col gap-3">
        <Link aria-label="Homepage" href="/">
          <Logo />
        </Link>
        <p className="max-w-(--container-measure-40) text-sm text-muted-foreground">
          An open-source dashboard for private blog networks. Astro publishing, links, and search
          data in one place.
        </p>
        <p className="text-xs text-muted-foreground">© 2026 Easeia. Software licensed under MIT.</p>
      </div>
      <nav
        aria-label="Footer"
        className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm font-semibold text-muted-foreground"
      >
        {LINKS.map((link) => (
          <a
            className="hover:text-foreground hover:underline hover:underline-offset-4"
            href={link.href}
            key={link.label}
          >
            {link.label}
          </a>
        ))}
      </nav>
    </div>
  </footer>
);
export { Footer };
