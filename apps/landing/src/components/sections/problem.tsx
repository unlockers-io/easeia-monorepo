import { Section } from "@/components/section";

const Problem = () => (
  <Section no="01" title="More sites mean more publishing work.">
    <div className="flex max-w-(--container-measure-65) flex-col gap-4 text-base text-pretty text-muted-foreground md:text-lg">
      <p>
        Each blog needs its own topics, draft queue, publishing schedule, and links. Across ten
        sites, checking what is ready and what failed becomes a daily job.
      </p>
      <p>
        Easeia puts those queues, links, and search reports in one dashboard. Your Astro sites keep
        serving their own pages; the worker handles the publishing jobs.
      </p>
      <p className="border-t border-foreground pt-4 font-semibold text-foreground">
        For affiliate and SEO operators running their own private blog networks.
      </p>
      <p className="text-sm">
        This is a shared admin tool for trusted operators. It does not publish into client CMSs or
        WordPress.
      </p>
    </div>
  </Section>
);
export { Problem };
