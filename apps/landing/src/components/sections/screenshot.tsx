import Image from "next/image";

const Screenshot = () => (
  <section aria-label="Dashboard screenshot" className="border-b border-foreground">
    <figure className="mx-auto max-w-(--breakpoint-xl) px-6 py-12 md:px-8 md:py-16">
      <figcaption className="mb-4 flex flex-wrap items-baseline justify-between gap-2 border-t-4 border-foreground pt-3 text-xs font-bold">
        <span>Fig. 2: Network report</span>
        <span className="text-muted-foreground">Demo data · four blogs and one money site</span>
      </figcaption>
      {/* oxlint-disable-next-line next/no-html-link-for-pages react-doctor/nextjs-no-a-element -- This opens a static PNG asset, not an App Router page. */}
      <a
        aria-label="View the full dashboard screenshot"
        className="block border border-border"
        href="/screenshots/dashboard.png"
      >
        <Image
          alt="Easeia network report showing site health, a publishing schedule, and recent jobs for fictional .example sites."
          className="h-auto w-full"
          height={1800}
          sizes="(max-width: 1280px) 100vw, 1216px"
          src="/screenshots/dashboard.png"
          width={2880}
        />
      </a>
    </figure>
  </section>
);
export { Screenshot };
