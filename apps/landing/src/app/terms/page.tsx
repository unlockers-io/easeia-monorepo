import type { Metadata } from "next";

export const metadata: Metadata = { alternates: { canonical: "/terms" }, title: "Terms of use" };

const Page = () => {
  return (
    <article className="mx-auto max-w-3xl px-6 py-16 md:px-8 md:py-24">
      <h1 className="text-4xl font-black tracking-display">Terms of use</h1>
      <p className="mt-3 text-sm text-muted-foreground">Updated September 8, 2026</p>
      <div className="mt-8 space-y-5 leading-7 text-muted-foreground [&_a]:text-foreground [&_a]:underline [&_a]:underline-offset-4 [&_h2]:pt-5 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-foreground">
        <p>
          Easeia is an open-source tool for operators managing their own blog networks. Contact{" "}
          <a href="mailto:hello@easeia.com">hello@easeia.com</a> with questions.
        </p>
        <h2>Self-hosted software</h2>
        <p>
          The software is provided under the MIT license, including its warranty and liability
          limitations. You operate your infrastructure and are responsible for credentials, backups,
          content, and compliance with applicable laws and provider terms.
        </p>
        <h2>Publishing and integrations</h2>
        <p>
          Publish only content you have the right to use. Review AI-generated text and images before
          publication. Easeia makes no promise of search rankings, traffic, revenue, or compliance
          with a search engine’s policies. Third-party services have their own terms and charges.
        </p>
        <h2>Cloud waitlist</h2>
        <p>
          Cloud is not yet available. Joining the waitlist is free and does not create a
          subscription, reserve a price, or guarantee access on a particular date. Pricing and
          service terms will be provided before a paid service becomes available.
        </p>
        <h2>This website</h2>
        <p>
          Do not abuse the website or API, send spam, or attempt unauthorized access. Product
          information may change as development continues.
        </p>
      </div>
    </article>
  );
};

export default Page;
