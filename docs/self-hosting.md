# Self-host Easeia

Easeia is a shared administrator dashboard for a private blog network of Astro sites. Every account can manage every site, post, and API key. Run one instance per trusted operator or team.

## Requirements

- Docker Engine with Compose v2, or Docker Desktop.
- At least 4 GB of memory available while building the images, and disk space for Postgres, Redis, and backups.
- An Astro site with a deploy hook for publishing. You can create sites and drafts before connecting one.

OpenAI, DataForSEO, Google, Resend, and Cloudflare R2 are optional. You can write Markdown and publish it without any of those accounts.

## Start with Docker Compose

```sh
git clone https://github.com/unlockers-io/easeia-monorepo.git
cd easeia-monorepo
cp .env.selfhost.example .env.selfhost
${EDITOR:-vi} .env.selfhost
docker compose --env-file .env.selfhost -f compose.selfhost.yml up --build -d
```

Before the final command, set `POSTGRES_PASSWORD` and `BETTER_AUTH_SECRET` to separate values generated with `openssl rand -hex 32`. Set `WP_ENCRYPTION_KEY` to the output of `openssl rand -base64 32`. Use a hexadecimal database password because Compose inserts it into a connection URL.

Open <http://localhost:3000/register> and create the administrator. With the default `SIGNUP_MODE=first-user`, registration closes as soon as that account exists. Use `closed` on an existing hosted instance. `open` gives every new user full administrator access.

The schema service creates the schema before the apps start. If you set all three `SEED_ADMIN_*` values, it also creates that administrator, preserving an existing account on reruns. Leave them unset to use registration.

Compose selects `Dockerfile.selfhost` explicitly. Hosted Railway services use their default Railpack builder; keeping the self-host Dockerfile under a distinct name prevents Railway from automatically selecting it for API/worker deployments.

Create a site in **Sites → Add site**, open its **Publishing** settings, and save your host's HTTP(S) deploy hook. Create a Markdown post, save a draft, then publish. The job appears in **Jobs**; the worker stores the published content and calls the hook. Configure your Astro consumer using the [integration guide](astro-integration.md).

The API exposes <http://localhost:4000/readyz>, <http://localhost:4000/docs>, and <http://localhost:4000/openapi.json>. Postgres and Redis stay inside the Compose network. The web/API ports bind to loopback for use behind a reverse proxy.

## Configuration

The [root environment example](../.env.example) documents every supported setting. Restart the apps after changing integration keys. **Settings → Integrations** shows missing variable names without exposing values.

| Feature                            | Variables                                                               | When absent                                                       |
| ---------------------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------- |
| AI drafts, rewrites, embeddings    | `OPENAI_API_KEY`                                                        | Manual writing and publishing remain available                    |
| Live SEO insights                  | `DATAFORSEO_LOGIN`, `DATAFORSEO_PASSWORD`                               | Configuration cards replace metered requests                      |
| Search Console                     | `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`                  | Google connection is unavailable                                  |
| Verification and recovery email    | `RESEND_API_KEY`, `FROM_EMAIL`                                          | Registration needs no verification; email recovery is unavailable |
| Image storage and generated images | All five `R2_*` variables                                               | Image uploads are unavailable                                     |
| AI model selection                 | `OPENAI_GENERATION_MODEL`, `OPENAI_REWRITE_MODEL`, `OPENAI_IMAGE_MODEL` | The documented defaults apply                                     |

Embedding storage uses `text-embedding-3-small` with 1536 dimensions. Changing it requires a schema change and re-embedding existing content; there is no embedding-model environment override.

`PUBLIC_WEB_URL` and `PUBLIC_API_URL` describe your browser-facing addresses. Compose gives the apps internal Postgres/Redis URLs separately. To change local published ports, set `WEB_PORT` and `API_PORT` and update the corresponding public URLs and `CORS_ORIGINS`.

Keep exactly **one worker replica**. It owns five in-process scheduler timers, so running additional replicas duplicates their scans. Tune `WORKER_CONCURRENCY` to control concurrent queue jobs within that worker.

## Monthly AI allowance

`AI_MONTHLY_BUDGET_USD` defaults to **18 USD across all sites**, per UTC calendar month. Set it identically on web, API, worker, and maintenance commands that share a database. `0` blocks new AI calls once enforcement is active. Images retain `OPENAI_IMAGE_QUALITY=medium`. `BODY_IMAGES_ENABLED=false` generates a hero at publication without automatic inline images; existing body images remain in place. Set the worker flag to `true` to opt into extra images and their cost. Daily publishing cadence is unchanged, but generation stops when the remaining allowance cannot cover the next request. Existing drafts can still publish, including without a newly generated hero.

When enforcement is active, all OpenAI requests reserve a conservative cost in the shared `AiMonthlyBudget` table before contacting OpenAI. Successful responses refund unused reservation using reported tokens; failed requests, missing usage, and failed settlements retain the reservation. Concurrent jobs and SDK retries each reserve separately. Database failures block requests. A reported cost exceeding its reservation halts that month for investigation. The next month starts a fresh allowance automatically. In-flight calls are attributed to the month in which they reserved.

The priced models are `gpt-5.6-luna` for text, `gpt-image-2` for images, and `text-embedding-3-small` for embeddings. Unknown models, streaming, stored conversation references, multimodal text inputs, and paid built-in tools are rejected. Text requests use the standard service tier and at most 16,384 output tokens. The guard budgets text at the higher long-context rates and ignores cache discounts. Images support one 1536×1024 output per request.

At 12 daily posts and one medium-quality hero per post, 360 images cost approximately **$14.82 in image output per 30 days** ($15.31 for 31 days), plus input tokens and text/embedding calls. This cuts the normal image count by about 80%. Retries and backfills also consume the allowance, so some posts may publish without a new hero, and draft generation may pause before the end of a busy month. Rates used as of September 14, 2026: text $0.40/$1.80 per million input/output tokens, image text input $5 and image output $30 per million tokens, embeddings $0.02 per million tokens. See [OpenAI pricing](https://developers.openai.com/api/docs/pricing) and the [image generation guide](https://developers.openai.com/api/docs/guides/image-generation). Review the rates in `packages/ai/src/budget-policy.ts` when provider pricing changes.

This allowance estimates application usage; it is not an OpenAI invoice or an account-wide billing limit. Calls outside this deployment, older deployments, provider pricing changes, and month-boundary billing attribution are outside its control. The $18 default leaves $2 below a $20 target. Reservations can stop generation before $18 of actual usage.

### Start enforcement on October 1

Set `AI_BUDGET_START_MONTH=2026-10` on every caller to leave September generation running and begin the allowance automatically at **2026-10-01 00:00 UTC**. Before this month, calls pass through without reserving budget or applying request limits. September is not capped or recorded in the new counter. Blank/unset enforces immediately; invalid month formats block requests. The examples use the October start date.

Apply the additive schema with `pnpm db:push` before October 1. Deploy web, API, and worker with the same budget/start-month settings and use the updated checkout for maintenance tools. Set `OPENAI_IMAGE_QUALITY=medium`, `HERO_AUTOGEN_ENABLED=true`, and `BODY_IMAGES_ENABLED=false` on the worker. Existing explicit environment values override the new defaults. Verify the deployed commit, especially after a failed deployment; old callers bypass the guard.

### Immediate enforcement on an existing installation

The table starts empty and cannot reconstruct previous charges. If enforcing immediately after spending has already occurred in that UTC month and the remaining budget is unknown or exhausted, run this SQL against the shared database before deploying the new callers:

```sql
INSERT INTO "AiMonthlyBudget" ("month", "usedMicroUsd", "halted")
VALUES (to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC', 'YYYY-MM'), 0, true)
ON CONFLICT ("month") DO UPDATE SET "halted" = true;
```

This preserves any recorded usage and pauses AI for the remainder of the current UTC month. It does not erase already incurred charges. **Do not halt September for the October-start rollout above.** Do not reset or delete an active month's counter to resume generation.

Inspect usage (including outstanding reservations) with:

```sql
SELECT "month", "usedMicroUsd" / 1000000.0 AS "reservedAndSpentUsd", "halted"
FROM "AiMonthlyBudget" ORDER BY "month" DESC;
```

The Postgres concurrency test uses a disposable database with the schema applied: `DATABASE_URL=... TEST_AI_BUDGET_DATABASE=true pnpm --filter @repo/ai test`. Do not run it against production.

## HTTPS and reverse proxies

Terminate HTTPS with Caddy, nginx, or your existing proxy. Forward the original `Host` and `X-Forwarded-Proto` headers.

For example, set:

```dotenv
PUBLIC_WEB_URL=https://app.example.com
PUBLIC_API_URL=https://api.example.com
AUTH_ALLOWED_HOSTS=app.example.com,api.example.com
CORS_ORIGINS=https://app.example.com
SIGNUP_MODE=first-user
```

Better Auth's secure-cookie setting follows `WEB_APP_URL`, which Compose fills from `PUBLIC_WEB_URL`. Keep the public URL's scheme correct. Add exact origins to `TRUSTED_ORIGINS` only when needed. If you serve the landing page, add its origin to `CORS_ORIGINS` for waitlist requests.

A minimal Caddy configuration on the Docker host:

```caddyfile
app.example.com {
  reverse_proxy 127.0.0.1:3000
}
api.example.com {
  reverse_proxy 127.0.0.1:4000
}
```

For IP-based rate limits behind a proxy, set `TRUSTED_PROXY_IPS` to its exact socket IP addresses as seen by the API. The proxy must append or replace `X-Forwarded-For`. Do not trust arbitrary client addresses. The built-in limits are per API process and reset on restart; use a shared edge limit when running multiple API replicas.

Register the Google OAuth callback as `https://app.example.com/api/google/callback`. Configure a verified Resend sender before enabling email.

## Upgrade

Back up Postgres and `.env.selfhost`, review the release notes, then:

```sh
git pull --ff-only
docker compose --env-file .env.selfhost -f compose.selfhost.yml build
docker compose --env-file .env.selfhost -f compose.selfhost.yml run --rm schema
docker compose --env-file .env.selfhost -f compose.selfhost.yml up -d
```

The schema service applies the schema with `db push`, so re-running it is safe. A failure prevents the first boot; inspect its logs and resolve the cause before starting the apps.

## Backups

```sh
docker compose --env-file .env.selfhost -f compose.selfhost.yml exec -T postgres \
  pg_dump -U easeia -d easeia -Fc > easeia-backup.dump
```

Back up `.env.selfhost` securely, especially `WP_ENCRYPTION_KEY`, which decrypts stored OAuth tokens. R2 objects live outside Postgres and need their own retention/backup policy. Redis persists queue state in its named volume; durable job records also live in Postgres.

Test restoring to a separate instance before relying on a backup. `docker compose down` preserves named volumes. **`down -v` deletes the database and queue volumes** and is only appropriate for disposable test installations.

## Troubleshooting

- **Apps do not start:** run `docker compose --env-file .env.selfhost -f compose.selfhost.yml logs schema api web worker`. Fix missing secrets or schema errors first.
- **Cannot register:** the instance may already have an administrator. Use the existing account or the explicitly configured seed; changing signup mode to `open` grants new accounts full access.
- **Cookies or OAuth fail:** check the public URL scheme, proxy headers, allowed hosts, and callback URL.
- **Publish is disabled:** configure a deploy hook and enable the site. The hook must accept an HTTP POST and trigger the Astro build.
- **Publish job fails:** inspect its message in Jobs; verify the deploy hook and Astro build API key. The content adapter needs `content:read` scoped to that site.
- **Missing AI/SEO/email features:** Settings lists exactly which environment variables are missing. Plain drafts and publishing do not require those integrations.
- **Port conflicts:** use `WEB_PORT`/`API_PORT` and keep public URLs in sync. The development infra uses different ports from the self-host stack.

## Development without Docker app images

Use Node 24 and pnpm 11. Configure the root `.env` from `.env.example`, start the development Postgres/Redis stack, then run:

```sh
pnpm install
pnpm db:push
pnpm dev:plain
```

The plain servers use web 3000, landing 3001, and API 4000. `dev:plain` loads the root environment and needs no global proxy tool. Portless remains available through `pnpm dev` for developers who prefer HTTPS `.localhost` URLs; see [CONTRIBUTING.md](../CONTRIBUTING.md).
