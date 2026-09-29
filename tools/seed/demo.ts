import "dotenv/config";

import { prisma } from "@repo/db";

import { seedAdmin } from "./admin";

// This fixture is deliberately restricted to a disposable local *_demo database.
const requireDemoDatabase = () => {
  const databaseUrl = new URL(process.env.DATABASE_URL ?? "");
  if (
    process.env.DEMO_SEED !== "true" ||
    !["localhost", "127.0.0.1"].includes(databaseUrl.hostname) ||
    !databaseUrl.pathname.endsWith("_demo")
  ) {
    throw new Error(
      "Demo seed requires DEMO_SEED=true and a local database whose name ends in _demo.",
    );
  }
  const password = process.env.DEMO_ADMIN_PASSWORD;
  if (password === undefined || password.length < 12) {
    throw new Error("Set DEMO_ADMIN_PASSWORD to a unique password of at least 12 characters.");
  }
  process.env.SEED_ADMIN_EMAIL = "demo@example.com";
  process.env.SEED_ADMIN_NAME = "Demo Operator";
  process.env.SEED_ADMIN_PASSWORD = password;
};

const SITES = [
  {
    domain: "fieldnotes.example",
    keyword: "weekend photography",
    score: 89,
    topic: "Field notes for a weekend photographer",
  },
  {
    domain: "weekendcook.example",
    keyword: "seasonal dinner",
    score: 84,
    topic: "Planning a seasonal dinner at home",
  },
  {
    domain: "photoblog.example",
    keyword: "natural light portraits",
    score: 93,
    topic: "Choosing a studio for natural light portraits",
  },
  {
    domain: "cityguide.example",
    keyword: "city walking route",
    score: 58,
    topic: "A walking route for an afternoon in the city",
  },
];

const ago = (days: number) => new Date(Date.now() - days * 86_400_000);

const seedSite = async (site: (typeof SITES)[number], index: number) => {
  const siteId = `demo-site-${index}`;
  const data = {
    authorBio: "An editorial team in the synthetic Easeia demo network.",
    authorName: "Demo Editorial",
    autoPublishEnabled: false,
    bucketRefillAt: null,
    bucketTarget: 6,
    cadenceDays: 2,
    defaultCategory: "journal",
    domain: site.domain,
    isEnabled: true,
    language: "EN" as const,
    moneySiteId: "demo-money-site",
    niches: ["PHOTOGRAPHY" as const, "LIFESTYLE" as const],
    topicHints: site.keyword,
    vercelDeployHookUrl: null,
  };
  await prisma.site.upsert({
    create: { id: siteId, ...data },
    update: data,
    where: { id: siteId },
  });
  for (let day = 0; day < 14; day += 1) {
    const date = ago(day);
    date.setUTCHours(0, 0, 0, 0);
    const snapshot = {
      backlinksTotal: 32 + index * 9,
      daysSinceLastPublish: 1,
      domainRank: 180 + index * 20,
      errors: { demo: "Synthetic measurements, not live provider data." },
      gscAvgPosition: 12.4 + index,
      gscClicks: 76 + index * 18,
      gscImpressions: 2100 + index * 700,
      healthScore: site.score - Math.floor(day / 4),
      onPageScore: site.score,
      postsLast30d: 6,
      postsLast7d: 6,
      reachable: true,
      referringDomains: 12 + index,
    };
    await prisma.siteSnapshot.upsert({
      create: { date, siteId, ...snapshot },
      update: snapshot,
      where: { siteId_date: { date, siteId } },
    });
  }
  for (let n = 0; n < 8; n += 1) {
    const id = `demo-post-${index}-${n}`;
    const published = n < 6;
    const body = `## Start with a clear plan\n\nThis is a synthetic article for the Easeia demo network. Choose one subject, make time to review it, and keep notes about what worked.\n\n## Look at the details\n\nA short checklist makes each session easier to prepare. Find more ideas in our [field notes](https://fieldnotes.example/journal/guide-1/) or compare [daylight studios](https://acmestudios.example/spaces/daylight/).\n\n## Review before publishing\n\nRead the draft, check each link, and add the context your readers need.`;
    const post = {
      body,
      categories: ["Journal"],
      createdAt: ago(n + 1),
      excerpt: "A practical starting point, written for a synthetic demo network.",
      focusKeyword: site.keyword,
      niches: data.niches,
      publishedAt: published ? ago(n + 1) : null,
      siteId,
      slug: `guide-${n + 1}`,
      status: published ? ("PUBLISHED" as const) : ("DRAFT" as const),
      tags: ["guides", "demo"],
      title: n === 0 ? site.topic : `${site.topic}: part ${n + 1}`,
    };
    await prisma.post.upsert({ create: { id, ...post }, update: post, where: { id } });
    if (published) {
      const job = {
        attempts: 1,
        createdAt: ago(n + 1),
        finishedAt: ago(n + 1),
        kind: n === 1 ? ("REWRITE_POST" as const) : ("PUBLISH" as const),
        payload: { demo: true },
        postId: id,
        siteId,
        startedAt: ago(n + 1),
        status: "DONE" as const,
      };
      await prisma.job.upsert({
        create: { id: `demo-job-${index}-${n}`, ...job },
        update: job,
        where: { id: `demo-job-${index}-${n}` },
      });
    }
  }
};

const seedLinks = async () => {
  for (let index = 0; index < SITES.length; index += 1) {
    const next = (index + 1) % SITES.length;
    const nextSite = SITES[next];
    if (nextSite === undefined) {
      throw new Error(`seedLinks: no site at index ${next}`);
    }
    for (let n = 0; n < 6; n += 1) {
      const link = {
        anchorText: "related editorial guide",
        fromPostId: `demo-post-${index}-${n}`,
        lastCheckedAt: ago(1),
        source: "IMPORTED" as const,
        status: "ACTIVE" as const,
        toPostId: `demo-post-${next}-${n}`,
        toUrl: `https://${nextSite.domain}/journal/guide-${n + 1}/`,
        type: "PBN" as const,
      };
      await prisma.link.upsert({
        create: { id: `demo-cross-${index}-${n}`, ...link },
        update: link,
        where: { id: `demo-cross-${index}-${n}` },
      });
      const moneyLink = {
        ...link,
        anchorText: "daylight studios",
        toPostId: null,
        toUrl: "https://acmestudios.example/spaces/daylight/",
        type: "EXTERNAL" as const,
      };
      await prisma.link.upsert({
        create: { id: `demo-money-${index}-${n}`, ...moneyLink },
        update: moneyLink,
        where: { id: `demo-money-${index}-${n}` },
      });
    }
  }
};

const main = async () => {
  requireDemoDatabase();
  await seedAdmin();
  const moneySite = {
    domain: "acmestudios.example",
    name: "Acme Studios",
    sitemapUrl: "https://acmestudios.example/sitemap.xml",
  };
  await prisma.moneySite.upsert({
    create: { id: "demo-money-site", ...moneySite },
    update: moneySite,
    where: { id: "demo-money-site" },
  });
  for (const name of ["daylight", "portraits", "events"]) {
    const page = {
      excerpt: "Synthetic studio listing for launch screenshots.",
      moneySiteId: "demo-money-site",
      title: `Acme ${name} studio`,
      url: `https://acmestudios.example/spaces/${name}/`,
    };
    await prisma.moneySitePage.upsert({
      create: { id: `demo-money-page-${name}`, ...page },
      update: page,
      where: { id: `demo-money-page-${name}` },
    });
  }
  for (const [index, site] of SITES.entries()) {
    await seedSite(site, index);
  }
  await seedLinks();
  console.log(
    "Seeded synthetic demo: 4 Astro sites, 1 money site, 32 posts, 48 links, 56 snapshots. Admin: demo@example.com",
  );
};
try {
  await main();
} finally {
  await prisma.$disconnect();
}
