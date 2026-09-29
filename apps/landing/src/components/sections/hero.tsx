import { buttonVariants } from "@repo/ui/components/button";
import { cn } from "@repo/ui/lib/utils";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { GITHUB_URL } from "@/lib/urls";

type Destination = { name: string; status: "building" | "published" | "target"; via: string };

/** Illustrative rows for Fig. 1; the names are placeholders, not customers. */
const DESTINATIONS: ReadonlyArray<Destination> = [
  { name: "fieldnotes.example", status: "published", via: "Astro" },
  { name: "weekendcook.example", status: "published", via: "Astro" },
  { name: "photoblog.example", status: "building", via: "Astro" },
  { name: "acmestudios.example", status: "target", via: "Money site" },
];

const STATUS = {
  building: { className: "text-foreground", label: "Building" },
  published: { className: "text-success", label: "Published" },
  target: { className: "text-foreground", label: "Linked" },
} satisfies Record<Destination["status"], { className: string; label: string }>;

const Hero = () => {
  return (
    <section className="border-b border-foreground">
      <div className="mx-auto grid max-w-(--breakpoint-xl) gap-x-6 gap-y-12 px-6 pt-16 pb-16 md:grid-cols-12 md:px-8 md:pt-20 md:pb-20">
        <div className="md:col-span-7">
          <h1 className="max-w-(--container-measure-14) text-5xl leading-hero font-black tracking-hero text-balance md:text-7xl lg:text-(length:--text-display-lg)">
            Run a private blog network from one dashboard.
          </h1>
          <p className="mt-7 max-w-(--container-measure-46) text-lg text-pretty text-muted-foreground md:text-xl">
            AI drafts, scheduled publishing to Astro, and cross-site links to money sites. Track
            rankings and Search Console data per post. Open source and self-hosted.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a className={cn(buttonVariants({ size: "lg" }))} href={GITHUB_URL}>
              Self-host on GitHub
              <ArrowRight />
            </a>
            <Link
              className={cn(buttonVariants({ size: "lg", variant: "outline" }))}
              href="/#waitlist"
            >
              Join the cloud waitlist
            </Link>
          </div>
          <p className="mt-5 text-sm text-muted-foreground">
            MIT licensed. Bring your own OpenAI and DataForSEO keys.
          </p>
        </div>

        <figure className="min-w-0 border-t-4 border-foreground pt-3 md:col-span-5">
          <figcaption className="flex items-baseline justify-between gap-3 text-xs font-bold">
            <span>Fig. 1: Sites in a network</span>
            <span className="text-muted-foreground">Illustration</span>
          </figcaption>
          <div className="mt-4 bg-muted px-4 py-3">
            <p className="text-(length:--text-intro) font-extrabold tracking-heading">
              A publishing queue for each site
            </p>
            <p className="text-(length:--text-label) text-muted-foreground">
              drafts · schedules · links · rankings
            </p>
          </div>
          <table className="mt-3 w-full border-collapse text-sm">
            <caption className="sr-only">
              Illustrative network: three Astro blogs and one money site
            </caption>
            <thead>
              <tr className="text-left text-xs font-bold text-muted-foreground">
                <th className="border-b border-foreground py-1.5 pr-2 font-bold">Site</th>
                <th className="border-b border-foreground py-1.5 pr-2 font-bold max-sm:hidden">
                  Type
                </th>
                <th className="border-b border-foreground py-1.5 font-bold">Status</th>
              </tr>
            </thead>
            <tbody>
              {DESTINATIONS.map((d) => (
                <tr key={d.name}>
                  <td className="border-b border-border py-2.5 pr-2 font-semibold">{d.name}</td>
                  <td className="border-b border-border py-2.5 pr-2 text-muted-foreground max-sm:hidden">
                    {d.via}
                  </td>
                  <td className="border-b border-border py-2.5">
                    <span
                      className={`text-xs font-extrabold tracking-wide uppercase ${STATUS[d.status].className}`}
                    >
                      {STATUS[d.status].label}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </figure>
      </div>
    </section>
  );
};

export { Hero };
