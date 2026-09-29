# Reproduce the launch screenshots

The committed captures show synthetic data, not customer activity or measured SEO results. Every domain is `.example`; the visible administrator is `demo@example.com`.

## Seed a disposable database

Use a separate local database whose name ends in `_demo`. Apply the schema and stop the worker before seeding so no crawler replaces the illustrative measurements. Never point this fixture at an operator database.

```sh
# In a checkout with Node 24 and pnpm 11:
export DATABASE_URL=postgresql://easeia:your-local-password@localhost:5440/easeia_demo
export DEMO_SEED=true
export DEMO_ADMIN_PASSWORD="$(openssl rand -hex 24)"
# Set BETTER_AUTH_SECRET and WP_ENCRYPTION_KEY as for a normal installation.
pnpm db:push
pnpm seed:demo
pnpm dev:plain --filter=web --filter=api
```

The script requires a loopback database host, the `_demo` suffix, an explicit opt-in, and a unique admin password. It upserts stable demo IDs; it never deletes existing data. It creates four Astro sites, one money site with three pages, 32 posts, 48 links, 56 daily snapshots, and completed example jobs. Automatic publishing and refill are disabled and deploy hooks are unset.

Sign in as `demo@example.com` with the password you supplied. Capture at a **1440 × 900 CSS viewport with device scale factor 2**, producing 2880 × 1800 PNGs. Wait for fonts, streamed content, and the graph to finish loading. Keep the visible email and `.example` domains in the captures.

| File in `apps/landing/public/screenshots/` | Route                            | Gallery caption                         |
| ------------------------------------------ | -------------------------------- | --------------------------------------- |
| `dashboard.png`                            | `/dashboard`                     | Network health and publishing activity  |
| `sites.png`                                | `/dashboard/sites`               | Manage the sites you own                |
| `post.png`                                 | `/dashboard/posts/demo-post-2-0` | Review a post and its links             |
| `network.png`                              | `/dashboard/network`             | Cross-site links and money-site targets |
| `buckets.png`                              | `/dashboard/buckets`             | Draft queues for every site             |

These five PNGs are the Product Hunt gallery images, in the order above. Use the original PNG files when uploading; do not invent integrations or metrics to improve a capture. The screenshot section and README use `dashboard.png`.

After capture, close the browser session and stop the demo services. Remove only the disposable resources you created, or keep them for review. The password is local and is never committed.
