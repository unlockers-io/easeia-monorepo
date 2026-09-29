import { buttonVariants } from "@repo/ui/components/button";
import { cn } from "@repo/ui/lib/utils";

import { WaitlistForm } from "@/components/waitlist-form";
import { DOCS_URL, GITHUB_URL } from "@/lib/urls";

const FinalCta = () => (
  <section className="scroll-mt-24" id="waitlist">
    <div className="mx-auto max-w-(--breakpoint-xl) px-6 py-20 md:px-8 md:py-28">
      <div className="grid gap-10 border-t-4 border-foreground pt-8 md:grid-cols-2 md:gap-16">
        <div>
          <h2 className="text-4xl leading-display font-black tracking-hero text-balance md:text-5xl">
            Run it yourself, or wait for Cloud.
          </h2>
          <p className="mt-5 max-w-(--container-measure-50) text-base text-pretty text-muted-foreground md:text-lg">
            The self-hosted dashboard is available now under the MIT license. Cloud pricing and
            availability will be announced at launch.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <a className={cn(buttonVariants({ size: "lg", variant: "outline" }))} href={GITHUB_URL}>
              Self-host on GitHub
            </a>
            <a className="font-semibold underline underline-offset-4" href={DOCS_URL}>
              Self-hosting guide
            </a>
          </div>
        </div>
        <div className="self-center">
          <WaitlistForm />
        </div>
      </div>
    </div>
  </section>
);
export { FinalCta };
