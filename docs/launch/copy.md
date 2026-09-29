# Launch copy

Drafts for owner review. No submissions have been sent. Publish only after the repository is public, self-host instructions pass from a fresh clone, and the hosted waitlist and contact inbox are verified.

## Show HN

**Title**

Show HN: Easeia – open-source dashboard for running a private blog network (Astro, Postgres, BullMQ)

**First comment**

I built Easeia to manage a private blog network from one dashboard. It keeps a draft queue for each site, schedules publishing to Astro, tracks cross-site links to money sites, and brings together rankings and Search Console reports.

The PBN framing is deliberate: this is for affiliate and SEO operators managing sites they own. It is not a client CMS or a WordPress publisher. Every account in an instance is a full administrator, so it belongs with one operator or a trusted team. It makes no promise of rankings or traffic.

The stack is Next.js, Hono, Postgres with pgvector, and BullMQ. Astro builds fetch published Markdown through a site-scoped API key. You can write and publish manually without AI keys. OpenAI, DataForSEO, Google Search Console, Resend, and R2 are optional integrations.

It is MIT licensed. After cloning and setting the secrets in `.env.selfhost`, start it with:

```sh
docker compose --env-file .env.selfhost -f compose.selfhost.yml up --build -d
```

Repository and setup: https://github.com/unlockers-io/easeia-monorepo

Managed hosting is planned; pricing is undecided. The Cloud waitlist is at https://easeia.com/#waitlist.

I would like feedback on the first-run publishing flow and the Astro build adapter, especially from people running several static sites.

## Product Hunt

**Name:** Easeia

**Tagline:** Open-source dashboard for private blog networks

**Description:** Manage drafts, scheduled Astro publishing, and cross-site links to money sites from one dashboard. Self-host with Docker under MIT, bring your own integration keys, or join the Cloud waitlist. Cloud pricing will be announced at launch.

**Gallery:** the five PNGs and captions listed in [demo.md](demo.md).

**Maker comment**

I built Easeia for the daily work of running several blogs: keeping draft queues filled, knowing what published, and reviewing which pages link to which money sites.

It is a private blog network tool, with an Astro publishing pipeline and a public REST API. It is designed for operators managing their own sites. All accounts on an instance share administrator access; there is no client isolation or billing system.

Self-hosting is available under MIT through Docker Compose. AI drafting and SEO reports use your own provider keys; manual writing and publishing work without them. The screenshots use fictional sites and synthetic measurements.

Cloud is still a waitlist, with no price or launch date promised. Setup and source: https://github.com/unlockers-io/easeia-monorepo. Cloud interest: https://easeia.com/#waitlist.

Feedback on installation, publishing, and the Astro integration would help decide what to improve next.
