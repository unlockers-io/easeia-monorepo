import { listMoneySites } from "@repo/money-sites";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";

import { CreateMoneySiteForm } from "./create-money-site-form";
import { RecrawlMoneySiteButton } from "./recrawl-money-site-button";

/** @public Next.js app-router reads metadata via the module loader */
export const metadata: Metadata = {
  title: "Money sites",
};

const MoneySitesPage = async () => {
  await connection();
  const items = await listMoneySites();

  return (
    <section className="max-w-3xl p-6">
      <h1 className="text-2xl font-semibold">Money sites</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        External sites the PBN network sends SEO juice to. Each PBN site can be assigned to one
        money site; the rewriter picks topically-relevant money-site pages as link targets.
      </p>

      <CreateMoneySiteForm />

      {items.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">No money sites yet.</p>
      ) : null}

      <ul className="mt-6 space-y-2">
        {items.map(({ _count, contentPathPrefix, domain, id, name }) => (
          <li className="flex items-center justify-between rounded border p-3" key={id}>
            <div>
              <Link
                className="font-medium hover:underline"
                href={`/dashboard/money-sites/${id}`}
                prefetch
              >
                {name}
              </Link>
              <div className="text-xs text-muted-foreground">
                {domain} · {_count.pages} pages
                {contentPathPrefix !== null && contentPathPrefix !== ""
                  ? ` · prefix ${contentPathPrefix}`
                  : ""}
              </div>
            </div>
            <RecrawlMoneySiteButton id={id} />
          </li>
        ))}
      </ul>
    </section>
  );
};

export default MoneySitesPage;
