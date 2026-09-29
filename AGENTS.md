# AGENTS.md

Guidance for AI coding agents working in this repository. `CLAUDE.md` is a symlink to this file.

## What this repo is

**Easeia**: central admin + API for generating and publishing posts across a network of money sites (Astro). Generates post content with AI, uploads images to Cloudflare R2, stores posts in Postgres, and exposes a build-time REST API consumed by each Astro site's CI. External tools (e.g. N8N) can author posts programmatically via the public REST API. Workers handle the heavy lifting: publish, sync, crawl, hero generation, link suggestion.

## Stack

- **Framework:** Next.js 16 App Router (web, landing), Hono on Node.js (api), tsdown bundler (api, worker)
- **Language:** TypeScript strict
- **Styling:** Tailwind CSS v4, shadcn/ui patterns via `@repo/ui`
- **Database:** Prisma 7, PostgreSQL with `pgvector` (hosted instance uses Neon)
- **Auth:** Better Auth (admin sessions) + bearer API keys (public API)
- **Queue:** BullMQ on Redis (hosted instance uses Upstash); durable `Job` row in Postgres + queue behind one interface (`@repo/jobs`)
- **Object store:** Cloudflare R2 (S3-compatible) via `@repo/blob`
- **Email:** Resend (optional; `@repo/transactional`)
- **AI:** `@repo/ai` (post generation, rewrites), `@repo/hero` (images), `@repo/classify` (categorization)
- **Worker host:** Node.js (hosted instance uses Railway)
- **Monorepo:** Turborepo + pnpm workspaces, Node 24, pnpm 11
- **Linter / formatter:** oxlint, oxfmt
- **Testing:** Vitest (unit), Playwright (e2e: chromium, firefox, webkit)
- **Release:** Changesets (`pnpm changeset`, `pnpm release`)

## Layout

```
apps/           # Next.js + Hono runnable apps (web, landing, api, worker)
packages/       # @repo/* libraries shared across apps
tools/          # one-shot scripts (seed, backfill, rewrite-eval, etc.) run via `pnpm <script>`
docs/           # design notes
scripts/        # repo-local shell scripts
tests/          # cross-app Playwright e2e specs
```

### Apps

| App       | Framework                | Dev URL                            | Purpose                                |
| --------- | ------------------------ | ---------------------------------- | -------------------------------------- |
| `web`     | Next.js 16 (App Router)  | `https://easeia.web.localhost`     | Admin dashboard + Better Auth server   |
| `landing` | Next.js 16 (App Router)  | `https://easeia.landing.localhost` | Marketing landing page                 |
| `api`     | Hono on Node.js (tsdown) | `https://easeia.api.localhost`     | Public REST API                        |
| `worker`  | Node.js (tsdown)         | n/a                                | BullMQ consumer (publish, sync, crawl) |

### Packages

| Package                                                        | Purpose                                                                                           |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `@repo/ui`                                                     | Shared React components (Tailwind + CVA). TanStack Form fields (`Field`, `FieldGroup`, etc.).     |
| `@repo/auth`                                                   | Better Auth config. Exports `./server` (web and tools) and `./client` (web).                      |
| `@repo/db`                                                     | Prisma client singleton + schema.                                                                 |
| `@repo/blob`                                                   | Cloudflare R2 helpers (S3-compatible): upload, delete, URL resolution.                            |
| `@repo/sites`                                                  | Site lifecycle: public projection, Astro deploy-hook dispatch.                                    |
| `@repo/jobs`                                                   | Durable Job (Prisma `Job` row + BullMQ behind one interface).                                     |
| `@repo/posts`                                                  | Post intake: state machine + queue handoff. Used by admin + public API.                           |
| `@repo/policy`                                                 | Authorization policy. `can(actor, action)` is the only verb.                                      |
| `@repo/api-types`                                              | Shared zod schemas between admin and public REST API.                                             |
| `@repo/ai` / `@repo/hero` / `@repo/classify` / `@repo/rewrite` | LLM clients + image/niche/rewrite pipelines.                                                      |
| `@repo/dataforseo`                                             | DataForSEO client wrapper (keyword research, SERP).                                               |
| `@repo/links` / `@repo/suggest-links`                          | Cross-site internal-link graph + per-post link suggestions.                                       |
| `@repo/money-sites`                                            | Money-site registry (host, niche, deploy hook).                                                   |
| `@repo/search-console`                                         | Google Search Console client (OAuth tokens encrypted at rest).                                    |
| `@repo/transactional`                                          | Resend email templates + sender.                                                                  |
| `@repo/health`                                                 | On-page SEO scoring and health checks.                                                            |
| `@easeia/astro-content`                                        | Build-time content adapter: fetches posts from `/api/build/*` and surfaces them as Astro content. |
| `@repo/config-vitest`                                          | Shared Vitest config. Exports `react.ts` and `node.ts`.                                           |
| `@repo/typescript-config`                                      | Shared tsconfig bases.                                                                            |
| `@repo/observability`                                          | `evlog` wrapper: shared log fields plus Next.js, Hono, worker and Better Auth adapters.           |
| `@repo/portless-env`                                           | `applyPortlessUrls`: fills dev URL env vars from `portless get`.                                  |

### Tools (root `tools/`)

One-shot scripts run via `pnpm <script>` (see `package.json`) or `tsx tools/<name>/index.ts`. Notable: `seed/`, `seed-money-site/`, `backfill-permalinks/`, `recrawl-rewritten/`, `rewrite-eval/`, plus standalone `.ts` files for link audits and orphan-hero generation.

## Dev workflow

```bash
# All apps via portless (HTTPS .localhost URLs)
pnpm dev
pnpm dev --filter=web
pnpm dev --filter=api
pnpm dev --filter=worker

# Build / lint / typecheck / format
pnpm build
pnpm lint                  # oxlint .
pnpm typecheck             # turbo run typecheck
pnpm format                # oxfmt
pnpm format:check

# Tests
pnpm test                  # vitest unit tests (turbo run test)
pnpm test:e2e              # playwright (requires web + api running)
pnpm test:e2e:ui

# Database
pnpm db:generate
pnpm db:push
pnpm seed                  # SEED_ADMIN_*; development defaults outside production
pnpm seed <sites.json>     # admin user + Site upserts from domain list
pnpm seed:money-site

# Backfills + evals (rare)
pnpm backfill:permalinks
pnpm rewrite:eval

# Dead code / dupes / health
pnpm fallow:dead
pnpm fallow:dupes

# Release (Changesets; publishes @easeia/astro-content)
pnpm changeset
pnpm release
```

## Portless (dev URLs)

Each dev server runs behind portless. Stable HTTPS on `.localhost`.

```bash
npm install -g portless
sudo portless proxy start --https
```

| Service   | URL                                |
| --------- | ---------------------------------- |
| `web`     | `https://easeia.web.localhost`     |
| `landing` | `https://easeia.landing.localhost` |
| `api`     | `https://easeia.api.localhost`     |

The api exposes `/openapi.json`, the Scalar UI at `/docs`, and `/llms.txt`.

Worktree branch names auto-prefix the subdomain: branch `fix-styles` → `https://fix-styles.easeia.web.localhost`.

App configs resolve those URLs through `@repo/portless-env` rather than hardcoding them. `applyPortlessUrls({ ENV_VAR: ["<subdomain>"] })` runs at the top of each `next.config.ts` / `tsdown.config.ts` and shells out to `portless get` for every name, filling the env var only when it is unset or still holds the canonical `*.localhost` default. It is a no-op unless `PORTLESS_URL` is set, so CI and production keep their real values. Import it by bare specifier (`@repo/portless-env`): a relative path resolves from the process cwd and breaks `next start apps/web` from the repo root.

## Docker (local infra)

`docker-compose.yml` runs Postgres (pgvector/pgvector:pg18) on host port **5440** and Redis 7 on **6381**, both bound to non-default ports so this stack coexists with other local instances. Both volumes are ordinary project-scoped volumes (`easeia_postgres_data`, `easeia_redis_data`).

## Environment

Copy `.env.example` to `.env` at root. Per-app envs live in `apps/web/.env`, `apps/api/.env`, and `apps/worker/.env`.

| Var                         | Purpose                                                                                 |
| --------------------------- | --------------------------------------------------------------------------------------- |
| `DATABASE_URL`              | PostgreSQL with `pgvector` enabled (hosted instance uses Neon)                          |
| `REDIS_URL`                 | Redis URL for BullMQ (hosted instance uses Upstash)                                     |
| `BETTER_AUTH_SECRET`        | min 32 chars; identical across api + web                                                |
| `AUTH_ALLOWED_HOSTS`        | comma-separated host patterns trusted by Better Auth dynamic baseURL                    |
| `TRUSTED_ORIGINS`           | comma-separated exact origins for non-`.localhost` requests                             |
| `CORS_ORIGINS`              | comma-separated origins allowed by Hono CORS                                            |
| `WP_ENCRYPTION_KEY`         | AES-256-GCM key (32 bytes, base64): encrypts Google OAuth tokens (and WP creds) at rest |
| `DATAFORSEO_LOGIN/PASSWORD` | DataForSEO API credentials (password = generated API key, not account password)         |
| `RESEND_API_KEY`            | Optional. When unset, signup falls back to no-verification mode (see auth-config gate)  |
| `FROM_EMAIL`                | Required. Sender address for all auth/transactional mail; no default                    |
| `R2_ENDPOINT`               | Cloudflare R2 S3 endpoint (`https://<account>.r2.cloudflarestorage.com`)                |
| `R2_ACCESS_KEY_ID`          | R2 access key id                                                                        |
| `R2_SECRET_ACCESS_KEY`      | R2 secret access key                                                                    |
| `R2_BUCKET`                 | R2 bucket name (e.g. `easeia`)                                                          |
| `R2_PUBLIC_BASE_URL`        | Public read URL base: `r2.dev` subdomain or custom domain bound to the bucket           |

Turbo caches track server URLs, authentication configuration, and DATABASE_URL.

## Key relationships

- **Auth flow:** `web` uses `@repo/auth/client` → calls its own `/api/auth/*` route (`apps/web/src/app/api/auth/[...all]/route.ts`) → `@repo/auth/server` uses the Prisma adapter from `@repo/db`.
- **API structure:** Hono app, routes under `/api/*` (sites, posts, api-keys), health at `/healthz` and `/readyz`.
- **Public API auth:** Bearer token (`Authorization: Bearer <key>`) → `ApiKey` table sha256 lookup → scope check → audit log.
- **Publish pipeline:** `api` enqueues `Job(kind=PUBLISH)` via `@repo/jobs` → `worker` pulls from BullMQ → uploads images to R2 (`@repo/blob`) → writes Markdown body to DB → POSTs the Astro site's deploy hook. Each Astro site's CI then fetches its posts from `/api/build/sites/:siteId/posts` via `@easeia/astro-content`.
- **Build order:** Turbo `^build` and `build.dependsOn` includes `db:generate` so Prisma client is generated before dependents build.

## Conventions & gotchas

- **Path aliases:** `@/*` maps to `src/*` in all apps and packages.
- **Auth password minimum:** 12 characters. Sessions expire after 7 days.
- **`requireEmailVerification`** is gated on email-infra presence (Resend configured): never bare `true`. See the `auth-config` check.
- **Forms:** `@tanstack/react-form` (NOT react-hook-form). Zod validators on `onBlur` + `onChange`, field components from `@repo/ui`. NEVER use `field.handleChange` inside `useEffect`/`useCallback` with `field` in deps; use `field.form.setFieldValue(field.name, value)` with stable refs.
- **Encryption at rest:** Google OAuth tokens (and WP app passwords) encrypted via `WP_ENCRYPTION_KEY`; never logged, never returned in API responses.
- **Prisma config:** `prisma.config.ts` uses `process.env.DATABASE_URL ?? ""` so `prisma generate` works in CI without DB credentials.
- **Linting:** oxlint (`oxlint.config.ts`). Husky + lint-staged on pre-commit (oxlint + oxfmt staged files).
- **Bundler:** `tsdown` for `api` and `worker` (outputs `dist/`). Turbopack for Next.js dev (web + landing).
- **`pnpm-workspace.yaml`** uses `nodeLinker: hoisted`: needed by Prisma + sharp + msgpackr (`allowBuilds` list).
- **Volume names:** both volumes are project-scoped (`easeia_postgres_data`, `easeia_redis_data`).
- **Root `scripts/`** dir is itself a pnpm workspace member (see `pnpm-workspace.yaml`).

## CI (GitHub Actions)

Three workflows are checked in: `check.yml` (one job running the secret scan, formatting, dead-code analysis, lint, typecheck and unit tests), `e2e.yml`, and `react-doctor.yml` (pull requests only). Validation runs on pull requests, a weekly schedule and manual dispatch, never on pushes to `main`. `orchestrator standards --for .github/workflows/check.yml` prints the rules they follow.

`check.yml` also runs the Postgres-backed AI budget test and `pnpm audit --audit-level=high`, and `release.yml` dispatches it for the version PR.

## References

- Better Auth docs: <https://www.better-auth.com>
- Hono OpenAPI: <https://hono.dev/snippets/zod-openapi>
- Cloudflare R2 S3 API: <https://developers.cloudflare.com/r2/api/s3/api/>

## Design-system linting

Run `pnpm lint` after changes and fix every error. `oxlint.config.ts` registers `@shadcn/lint` and enforces all six rules as errors: component contracts, known Tailwind classes, static component class names, semantic colors, theme or scale values, and class-based styling. Use CSS custom properties for runtime geometry and named theme tokens for custom values. Use component variants for appearance and layout classes at call sites. All six rules also apply inside primitive directories. Shared styles belong to component variants or the owning stylesheet. Keep theme discovery local to each app. Exact class-merging fixture allowances apply only to the named test files.

Table cells allow typography, spacing, and muted text to express data types; table headers may use the card surface. Field groups own their content spacing, titles may space icons, and logo callers may scale the wordmark. Keep upstream component options intact. Product badge states live in compositions; put typography on content or a surrounding wrapper and choose upstream button sizes.

## Upstream UI components

Keep registry primitives in `packages/ui/src/components` aligned with their configured shadcn Base UI style. Product adapters belong in `packages/ui/src/compositions`. Import variant factories beside the component, use local input IDs, normalize arbitrary validators through `FormFieldError`, and preserve semantic headings at call sites. Keep product branding in the theme, load `shadcn/tailwind.css`, and run `pnpm check:shadcn` with lint, typechecks, tests and the build. See `packages/ui/SHADCN.md` before updating the reviewed source lock.
