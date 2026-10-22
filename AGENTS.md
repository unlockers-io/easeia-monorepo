# AGENTS.md

Guidance for AI coding agents working in this repository. `CLAUDE.md` is a symlink to this file.

## Friction Log

- Log papercuts and friction (tooling, docs, APIs, tests, conventions) as you hit them with `npx frog log`.
- Do not add global, system, or internal friction.
- Run `npx frog list` first to see what is already known.

Entries live in `.agents/friction-log/`, one directory each. A GitHub Action reports them as issues and deletes the entry once the issue closes, so anything still in that directory is still outstanding.

## Standards

This repo follows the fleet's shared standards, checked by `standy` (`~/dev/standy`).

- Before editing, run `standy standards --for <paths>` for the rules that apply to the files you will touch.
- Before finishing, run `standy check --changed --fix-hints` and fix what fails. It only sees tracked files, so run `git add -N` on new files first.
- When a failure is unclear, `standy explain <rule>` prints what the rule asserts, why, and how to fix it.

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

Domain terms are defined in `GLOSSARY.md`; architecture decisions are in `docs/adr/`.

## Layout

```
apps/           # Next.js + Hono runnable apps (web, landing, api, worker)
packages/       # @repo/* libraries shared across apps
tools/          # one-shot scripts (seed, backfill, rewrite-eval, etc.) run via `pnpm <script>`
docs/           # design notes; docs/adr/ holds architecture decisions
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

| Package                                                        | Purpose                                                                                             |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `@repo/ui`                                                     | Shared React components (Tailwind + CVA). TanStack Form fields (`Field`, `FieldGroup`, etc.).       |
| `@repo/auth`                                                   | Better Auth config. Exports `./server` (web and tools) and `./client` (web).                        |
| `@repo/db`                                                     | Prisma client singleton + schema.                                                                   |
| `@repo/blob`                                                   | Cloudflare R2 helpers (S3-compatible): upload, delete, URL resolution.                              |
| `@repo/sites`                                                  | Site aggregate: sole writer, enabled/publishable gates, public projection, redeploy, snapshots.     |
| `@repo/jobs`                                                   | Durable Job: sole reader and writer of `Job` rows; BullMQ queues and job schedulers on `REDIS_URL`. |
| `@repo/backfill`                                               | Network and rewrite backfills: single-run start, phase ticks, status.                               |
| `@repo/posts`                                                  | Post intake: transitions and what each sets off, the only body write (normalized), reads.           |
| `@repo/auto-publish`                                           | Auto-publish schedule: cadence and bucket config, due rule, bucket refill, draft claim, tick.       |
| `@repo/policy`                                                 | Access: API-key authentication and lifecycle, `can` authorization with Site binding, AuditLog.      |
| `@repo/api-types`                                              | Shared zod schemas between admin and public REST API.                                               |
| `@repo/ai` / `@repo/hero` / `@repo/classify` / `@repo/rewrite` | AI interface (structured text, image, embedding; owns models + budget) and pipelines on it.         |
| `@repo/dataforseo`                                             | DataForSEO client: Site market per language, request timeout, on-page check meanings.               |
| `@repo/links`                                                  | Link lifecycle: crawl, suggest, approve-and-apply, prune; the live-link rule and its reads.         |
| `@repo/money-sites`                                            | Money-site registry (host, niche, deploy hook).                                                     |
| `@repo/search-console`                                         | Search Console per Site (`forSite(domain)`): connection, property, token refresh, OAuth connect.    |
| `@repo/transactional`                                          | Resend email templates + sender.                                                                    |
| `@repo/health`                                                 | On-page SEO scoring and health checks.                                                              |
| `@easeia/astro-content`                                        | Build-time content adapter: fetches posts from `/api/build/*` and surfaces them as Astro content.   |
| `@repo/config-vitest`                                          | Shared Vitest config. Exports `react.ts` and `node.ts`.                                             |
| `@repo/typescript-config`                                      | Shared tsconfig bases.                                                                              |
| `@repo/observability`                                          | `evlog` wrapper: shared log fields plus Next.js, Hono, worker and Better Auth adapters.             |
| `@repo/portless-env`                                           | App registry (`./apps`: names, ports, URL defaults) + `portless get` lookup (`applyPortlessUrls`).  |

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
# Postgres- and Redis-backed suites: point at a disposable database with the schema pushed
DATABASE_URL=... REDIS_URL=... TEST_DATABASE=true TEST_REDIS=true pnpm exec turbo run test --concurrency=1
pnpm test:e2e              # playwright (requires web + api running)
pnpm test:e2e:ui

# Database
pnpm db:generate
pnpm db:push
pnpm db:seed               # SEED_ADMIN_*; development defaults outside production
pnpm db:seed <sites.json>  # admin user + Site upserts from domain list
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

`packages/portless-env/src/apps.ts` is the app registry: each app's Portless name and loopback port, the URL env vars each app fills, and the canonical `https://<name>.localhost` defaults derived from the names. Add or rename an app there. Application code reads defaults from the browser-safe `@repo/portless-env/apps` (auth host patterns, trusted origins and baseURL fallback, the web `metadataBase`, the api `PORT` and OpenAPI server, Playwright's loopback URLs); it has no `node:` imports.

App configs call `applyPortlessUrls(["WEB_APP_URL", …])` from `@repo/portless-env` at the top of each `next.config.ts` / `tsdown.config.ts`. It runs `portless get` once per app and fills each env var only when it is unset or still holds its canonical default; a failed lookup throws. It is a no-op unless `PORTLESS_URL` is set, so CI and production keep their real values. Tests in `tests/e2e` import URLs from `tests/e2e/urls.ts`, which asks portless locally and uses loopback ports in CI. Import the package by bare specifier: a relative path resolves from the process cwd and breaks `next start apps/web` from the repo root.

The `dev` and `dev:plain` scripts, `allowedDevOrigins` and the e2e workflow's URL env vars must stay literal; `packages/portless-env/src/apps.test.ts` asserts they match the registry.

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
- **Access:** `@repo/policy` owns both Channels' access rules. `authenticate` turns `Authorization: Bearer <key>` into an Actor (sha256 lookup, revoked keys rejected); `can(actor, action, siteId?)` is the only authorization verb, and the api guard passes a route's `:siteId` so Site-bound keys stay on their Site; `createApiKey` returns the plaintext once, `listApiKeys`/`revokeApiKey` serve the api routes and the admin page; `recordAudit` writes AuditLog rows for API actors and for admin actions (session user as actor) through `apps/web/src/lib/access.ts`.
- **Publish pipeline:** `Posts.publish` (or `create` with `publish`) claims the Post as SCHEDULED and enqueues `Job(kind=PUBLISH)` → the worker's handler calls `Posts.startPublish` (Site gate, fallback category), prunes fabricated links, ensures the hero image in R2 (`@repo/blob`), then `Posts.completePublish` atomically marks it PUBLISHED and records the redeploy, EMBED, CRAWL_LINKS and GENERATE_BODY_IMAGES intents. The coalesced `TRIGGER_DEPLOY` Job POSTs the deploy hook through `Sites.deploy`. Each Astro site's CI then fetches its posts from `/api/build/sites/:siteId/posts` via `@easeia/astro-content`. The worker dispatches committed Job intents every second and reconciles missing queue entries. ADR-0008 and ADR-0011 define transition consequences and recovery.
- **Ticks and auto-publish:** the worker registers its periodic work as BullMQ job schedulers through `Jobs.schedule` (`REAP_STUCK_JOBS`, `REQUEST_SNAPSHOTS`, `AUTO_PUBLISH`, `BACKFILL_HEROES`, `AUDIT_SLUG_DRIFT`); each run is one Job row and runs once whatever the replica count. `AUTO_PUBLISH` calls `AutoPublish.tick`: it claims the oldest bucket draft (DRAFT without `scheduledAt`) of each due Site through `Posts.publishBucketDraft`, stamps `lastAutoPublishedAt` through `Sites.update`, then refills buckets with GENERATE_POST Jobs. Web actions call `@repo/auto-publish` for schedule config and manual refills. ADR-0010.
- **Post body:** every body write goes through `@repo/posts` (`create`, `update`, `reviseBody`), which stores `normalizeBody(raw, site.language)`: control characters stripped, HTML to Markdown, repeated versions collapsed, em-dash rules by language. `reviseBody` is a compare-and-set on the body the writer read. ADR-0009.
- **AI:** `@repo/ai` is the only module that calls OpenAI: `generateStructured` (one retry on a schema failure), `generateImage`, `embedText`, all through the budgeted transport priced from `packages/ai/src/models.ts`. `AiNotConfiguredError` and `AiBudgetExceededError` (both `AiUnavailableError`) end a Job FAILED without retry; when AI is unconfigured, CLASSIFY, EMBED, GENERATE_IMAGE and GENERATE_BODY_IMAGES complete instead (`apps/worker/src/lib/ai-unavailable.ts`). Tests drive the real interface through `createFakeOpenAi` from `@repo/ai/testing`.
- **Build order:** Turbo `^build` and `build.dependsOn` includes `db:generate` so Prisma client is generated before dependents build.

## Conventions & gotchas

- **Path aliases:** `@/*` maps to `src/*` in all apps and packages.
- **Auth password minimum:** 12 characters. Sessions expire after 7 days.
- **`requireEmailVerification`** is gated on email-infra presence (Resend configured): never bare `true`. See the `auth-config` check.
- **Forms:** `@tanstack/react-form` (NOT react-hook-form), field components from `@repo/ui`. NEVER use `field.handleChange` inside `useEffect`/`useCallback` with `field` in deps; use `field.form.setFieldValue(field.name, value)` with stable refs. Validation follows six rules:
  1. Validate on submit, then on every change: `validationLogic: revalidateLogic()` with `validators: { onDynamic: schema }`. Put every rule in that one form-level Zod schema, never in field-level `validators`: TanStack runs form-level validators on submit only after field-level ones pass, so mixing them shows partial errors. No error shows before the first submit attempt; after a failed one, an error clears on the keystroke that fixes it. Never validate on blur.
  2. Show a field's error, `aria-invalid` and `data-invalid` whenever `!field.state.meta.isValid`. Don't add an `isTouched`, `isBlurred`, `isDirty` or `submissionAttempts` check: rule 1 already holds errors back until submit. `AuthPasswordField` does this for the auth password inputs.
  3. On a failed submit, `onSubmitInvalid` calls `focusFirstInvalidField(formRef.current)` from `@repo/ui/lib/focus-first-invalid-field`, with `ref={formRef}` on the `ClientReadyForm`. It focuses the first `[aria-invalid="true"]` control a frame later, because TanStack calls `onSubmitInvalid` before React renders the invalid state, while controls may still be disabled.
  4. Explain any rule people can't guess (password length, name length, slug characters) with a `FieldDescription` under the field from the start, linked through `aria-describedby`; `AuthPasswordField` takes a `description`. Live hints derive from the value; they are not validation errors.
  5. Server-only failures (wrong password, taken domain, rate limits) arrive on submit. Attach each one to its field, or report it form-wide: a toast in the auth forms, otherwise an inline message that clears on the next change through the form's `listeners: { onChange }` (or the reducer, in forms without TanStack). Keep auth failures generic.
  6. Keep the submit button enabled, and disable it only while submitting (`isSubmitting` or the mutation's pending flag). Never disable it on `!canSubmit` or `!isValid`: a disabled button can't say which field is wrong. The one exception is a form with exactly one editable field, which may also disable submit while that field is empty or unchanged, where empty is the obvious error (the backlinks CSV import).
- **Encryption at rest:** Google OAuth tokens (and WP app passwords) encrypted via `WP_ENCRYPTION_KEY`; never logged, never returned in API responses.
- **Prisma config:** `prisma.config.ts` uses `process.env.DATABASE_URL ?? ""` so `prisma generate` works in CI without DB credentials.
- **Linting:** oxlint (`oxlint.config.ts`). Husky + lint-staged on pre-commit (oxlint + oxfmt staged files).
- **Bundler:** `tsdown` for `api` and `worker` (outputs `dist/`). Turbopack for Next.js dev (web + landing).
- **`pnpm-workspace.yaml`** uses `nodeLinker: hoisted`: needed by Prisma + sharp + msgpackr (`allowBuilds` list).
- **Volume names:** both volumes are project-scoped (`easeia_postgres_data`, `easeia_redis_data`).
- **Root `scripts/`** dir is itself a pnpm workspace member (see `pnpm-workspace.yaml`).

## CI (GitHub Actions)

Four workflows are checked in:

- `check.yml`: one job running the gitleaks secret scan, formatting, dead-code analysis, the shadcn component check, lint, typecheck, the test suite against Postgres and Redis service containers (`TEST_DATABASE` and `TEST_REDIS` enable the database-backed suites) and `pnpm audit --audit-level=high`.
- `e2e.yml`: builds `web`, `api` and `landing`, then runs the Playwright suite in Chromium against Postgres and Redis service containers.
- `react-doctor.yml`: React Doctor on pull requests only.
- `release.yml`: runs on pushes to `main`. The Changesets action opens the "chore: version packages" PR or, once that PR merges, publishes `@easeia/astro-content` through npm trusted publishing and confirms the version reached the registry. It dispatches every workflow that declares both `pull_request` and `workflow_dispatch` (`check.yml` and `e2e.yml`) onto the version PR, whose own `pull_request` runs never execute.

`check.yml` and `e2e.yml` run on pull requests, a weekly schedule and manual dispatch, never on pushes to `main`. `standy standards --for .github/workflows/check.yml` prints the rules they follow.

## References

- Better Auth docs: <https://www.better-auth.com>
- Hono OpenAPI: <https://hono.dev/snippets/zod-openapi>
- Cloudflare R2 S3 API: <https://developers.cloudflare.com/r2/api/s3/api/>

## Design-system linting

Run `pnpm lint` after changes and fix every error. `oxlint.config.ts` registers `@shadcn/lint` and enforces all six rules as errors: component contracts, known Tailwind classes, static component class names, semantic colors, theme or scale values, and class-based styling. Use CSS custom properties for runtime geometry and named theme tokens for custom values. Use component variants for appearance and layout classes at call sites. All six rules also apply inside primitive directories. Shared styles belong to component variants or the owning stylesheet. Keep theme discovery local to each app. Exact class-merging fixture allowances apply only to the named test files.

Table cells allow typography, spacing, and muted text to express data types; table headers may use the card surface. Field groups own their content spacing, titles may space icons, and logo callers may scale the wordmark. Keep upstream component options intact. Product badge states live in compositions; put typography on content or a surrounding wrapper and choose upstream button sizes.

## Upstream UI components

Keep registry primitives in `packages/ui/src/components` aligned with their configured shadcn Base UI style. Product adapters belong in `packages/ui/src/compositions`. Import variant factories beside the component, use local input IDs, normalize arbitrary validators through `FormFieldError`, and preserve semantic headings at call sites. Keep product branding in the theme, load `shadcn/tailwind.css`, and run `pnpm check:shadcn` with lint, typechecks, tests and the build. See `packages/ui/SHADCN.md` before updating the reviewed source lock.
