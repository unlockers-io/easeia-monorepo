# Contributing to Easeia

Easeia manages a network of Astro sites, with AI drafting, scheduled publishing,
and links to money sites. Bug reports, documentation fixes, and focused pull
requests are welcome. Please open an issue before starting a large change.

## Development setup

Use Node.js 24 or newer, pnpm 11, and Docker for local PostgreSQL and Redis.

```bash
pnpm install --frozen-lockfile
cp .env.example .env
docker compose up -d
pnpm db:push
```

Set `BETTER_AUTH_SECRET` and `WP_ENCRYPTION_KEY` in `.env` using the guidance
in `.env.example`. Copy the per-app `.env.example` files to `.env` in the apps
you run and fill their required values. Use a local database for development.

The current dev scripts use [portless](https://github.com/vercel-labs/portless):

```bash
npm install -g portless
sudo portless proxy start --https
pnpm seed
pnpm dev
```

`pnpm seed` reads `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, and `SEED_ADMIN_NAME`.
Outside production, omitted values use development defaults from
`tools/seed/admin.ts`. Production requires all three values. Existing accounts
are preserved. Use the configured email and password to sign in.

See [AGENTS.md](AGENTS.md) for package boundaries, dev URLs, and conventions.

## Before submitting

Keep changes focused and explain the problem, resulting behavior, and validation
in the pull request. Add regression tests for behavior changes. Use fictional
`.example` domains and synthetic data in fixtures and screenshots.

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm format:check
```

Run the relevant Playwright tests for changes to browser flows. If your change
affects the published `@easeia/astro-content` package, add a changeset with
`pnpm changeset`.

Do not commit credentials, database exports, customer data, or local agent
artifacts. Report security issues privately as described in [SECURITY.md](SECURITY.md).

Participation follows our [Code of Conduct](CODE_OF_CONDUCT.md). Contributions
are licensed under the repository's [MIT license](LICENSE).
