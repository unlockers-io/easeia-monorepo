import { Section } from "@/components/section";

type Step = {
  description: string;
  title: string;
};

const STEPS: ReadonlyArray<Step> = [
  {
    description:
      "Add a domain and deploy hook. Create a site-scoped content:read API key and configure the Astro content adapter to fetch that site's posts.",
    title: "Connect sites",
  },
  {
    description:
      "Write Markdown drafts or generate articles with your OpenAI key. Set each site's niche, keywords, and publishing preferences.",
    title: "Fill the buckets",
  },
  {
    description:
      "Publish manually or enable a schedule. Follow the queued job in the dashboard; your site's deploy hook starts the Astro build.",
    title: "Publish on cadence",
  },
];

const HowItWorks = () => {
  return (
    <Section id="how-it-works" no="03" title="Three steps from first connection to live posts.">
      <ol className="border-t border-foreground">
        {STEPS.map((step, index) => (
          <li
            className="grid grid-cols-steps items-baseline gap-4 border-b border-border py-5"
            key={step.title}
          >
            <span
              aria-hidden="true"
              className="text-4xl leading-none font-black tracking-hero tabular-nums"
            >
              {index + 1}
            </span>
            <div>
              <p className="text-lg font-extrabold tracking-heading">{step.title}</p>
              <p className="mt-1.5 max-w-(--container-measure-footer) text-sm text-pretty text-muted-foreground">
                {step.description}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </Section>
  );
};

export { HowItWorks };
