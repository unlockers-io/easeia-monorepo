import { Section } from "@/components/section";

type Capability = {
  description: string;
  title: string;
};

const CAPABILITIES: ReadonlyArray<Capability> = [
  {
    description:
      "Fill each site's draft bucket with articles for its niche and keywords. Review the Markdown or write it yourself. AI generation uses your OpenAI key.",
    title: "AI drafts per site",
  },
  {
    description:
      "Set a cadence for each site. The worker publishes queued drafts and calls your deploy hook so Astro can rebuild from the content API.",
    title: "Scheduled publishing to Astro",
  },
  {
    description:
      "Inspect internal, cross-site, and external links. Find broken destinations and review link suggestions before accepting them.",
    title: "Cross-site link graph",
  },
  {
    description:
      "Register money sites, crawl their pages, and assign blog sites to a target. Review which posts link to which commercial pages.",
    title: "Money-site targeting",
  },
  {
    description:
      "Connect DataForSEO for keyword rankings and Google Search Console for clicks and impressions. Each integration is optional.",
    title: "Rank and Search Console tracking",
  },
  {
    description:
      "Create drafts, request publishing, and check jobs from N8N or your own scripts. Give each tool only the scopes it needs.",
    title: "Public API with scoped keys",
  },
];

const Capabilities = () => {
  return (
    <Section
      id="capabilities"
      intro="One dashboard for the sites you own, backed by Postgres and a durable publish queue."
      no="02"
      title="Manage drafts, publishing, links, and search data."
    >
      <dl className="grid border-t border-foreground sm:grid-cols-2 sm:gap-x-8">
        {CAPABILITIES.map((cap) => (
          <div className="border-b border-border py-5" key={cap.title}>
            <dt className="text-lg font-extrabold tracking-heading">{cap.title}</dt>
            <dd className="mt-2 max-w-(--container-measure-42) text-sm text-pretty text-muted-foreground">
              {cap.description}
            </dd>
          </div>
        ))}
      </dl>
    </Section>
  );
};

export { Capabilities };
