import { buttonVariants } from "@repo/ui/components/button";
import { cn } from "@repo/ui/lib/utils";

import { Section } from "@/components/section";
import { GITHUB_URL } from "@/lib/urls";

const TIERS = [
  {
    cta: "View on GitHub",
    description:
      "Run Easeia on your own infrastructure. You pay your hosting and integration providers directly.",
    detail: "open source, MIT",
    features: [
      "Unlimited sites, posts, and API keys",
      "Bring your own integration keys",
      "Docker Compose installation",
      "Community support on GitHub",
    ],
    href: GITHUB_URL,
    name: "Self-hosted",
    price: "$0",
  },
  {
    cta: "Join the waitlist",
    description:
      "Register your interest in managed hosting. Cloud is not available yet; no payment is collected.",
    detail: "pricing announced at launch",
    features: [
      "Managed hosting planned",
      "Same dashboard and public API",
      "Launch updates by email",
    ],
    href: "/#waitlist",
    name: "Cloud",
    price: "Waitlist",
  },
];

const Pricing = () => (
  <Section
    id="pricing"
    intro="Self-host today. Join the waitlist if you would prefer managed hosting."
    no="05"
    title="Free to self-host. Cloud is coming."
    wide
  >
    <div className="grid border-t-4 border-foreground lg:grid-cols-2 lg:gap-x-12">
      {TIERS.map((tier, index) => (
        <div className="flex flex-col py-6 max-lg:border-b max-lg:border-border" key={tier.name}>
          <p className="text-(length:--text-label) font-black tabular-nums">05.{index + 1}</p>
          <h3 className="mt-1 text-3xl font-black tracking-hero">{tier.name}</h3>
          <p className="mt-2 min-h-plan-description max-w-(--container-measure-body) text-sm text-pretty text-muted-foreground">
            {tier.description}
          </p>
          <div className="mt-4 border-t border-foreground pt-3">
            <p className="text-5xl leading-none font-black tracking-hero tabular-nums">
              {tier.price}
            </p>
            <p className="mt-2 text-sm font-semibold text-muted-foreground">{tier.detail}</p>
          </div>
          <ul className="mt-5 mb-6 text-sm">
            {tier.features.map((feature) => (
              <li className="border-t border-border py-2" key={feature}>
                {feature}
              </li>
            ))}
          </ul>
          <a
            className={cn(
              buttonVariants({
                className: "mt-auto w-full",
                size: "lg",
                variant: "outline",
              }),
            )}
            href={tier.href}
          >
            {tier.cta}
          </a>
        </div>
      ))}
    </div>
  </Section>
);
export { Pricing };
