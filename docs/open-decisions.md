# Open decisions

Decisions about Easeia that nobody has made yet. Each entry says what the code does today, why changing it is a decision and not a refactor, the options, and what to find out first. What was decided lives in [adr/](adr/); delete an entry here when its decision is made, and write an ADR if the decision is architectural.

Production queries below are read-only. How a schema change reaches production is in [hosted-deployment.md](hosted-deployment.md).

## One domain or two: `easeia.com` and `easeia.dev`

**Today.** The apps, the OpenAPI document, `SECURITY.md` and `packages/identity/src/index.ts` say `easeia.com`, with `hello@easeia.com` as the contact, security and support address. Three places say `easeia.dev`:

- Every email links to `https://easeia.dev` (`packages/transactional/src/emails/base-layout.tsx`) and loads its logo from `https://www.easeia.dev/logo-wordmark.svg` (`packages/transactional/src/components/logo.tsx`).
- The sign-up-attempt email tells the reader to write to `security@easeia.dev` (`packages/transactional/src/emails/sign-up-attempt.tsx`).
- The money-site crawler identifies itself as `Easeia/1.0 (+https://easeia.dev)` (`packages/money-sites/src/crawl.ts`).

**Why it is open.** These are values in every email a user receives and in every request to a site Easeia crawls. Whichever domain is wrong, a link, an image or a security address goes somewhere the product does not control.

**Options.**

1. `easeia.com` everywhere. The emails take their links and the security address from `@repo/identity`, and the crawler takes its URL from there too. The landing site has to serve the logo first: `apps/landing/public` holds no `logo-wordmark.svg` today. Recommended, because the identity module already is the one place the rest of the product reads.
2. `easeia.dev` is a second domain the product owns. Add its origin and the `security@` address to the identity registry so the module carries them, and import them. Nothing a user sees changes.
3. Leave the literals.

**Know first.** Whether `easeia.dev` is registered to you, whether `https://www.easeia.dev/logo-wordmark.svg` loads, and whether mail to `security@easeia.dev` arrives. Send yourself a password-reset email from production and look at the logo.

**Then.** The four literals go, and a domain change is one edit.

## What a Site-bound API key can reach, and the `links:*` scopes

**Today.** An API key can be bound to one Site (`siteId` in `packages/api-types/src/api-keys.ts`). `can` in `packages/policy/src/authorize.ts` holds a bound key to its Site only when the route passes a Site id, which the `sites/:id` and build routes do. The posts, suggestions, jobs, rewrite and backfill routes pass none, and for those a bound key is refused only if the scope is `content:read`. So a key created for one Site with `posts:write` can create, edit, publish and delete posts on every Site.

Separately, `API_KEY_SCOPES` offers `links:read` and `links:write` and the create-key dialog lists them, but no route requires them: the suggestion routes in `apps/api/src/routes/suggestions.ts` require `posts:read` and `posts:write`.

**Why it is open.** Both are authorization changes on a public API. Tightening the first can make a key that works today start answering 403.

**Options for the bound key.**

1. A bound key reaches only its Site on every route: post routes load the post's Site and pass it to `can`, list routes filter by it. Recommended; it is what "bound to a Site" says.
2. Binding means only what it does today. Say so in the create-key dialog and the API reference, so nobody hands out a bound key as a limited one.

**Options for `links:*`.**

1. Remove both scopes from the list. Keys that carry them keep working, because `can` checks only the scope a route asks for. Recommended.
2. Make the suggestion routes require them. Keys with only `posts:*` lose those routes.

**Know first.** Which live keys are bound and carry a scope that is not `content:read`:

```sql
SELECT id, name, scopes, "siteId", "lastUsed" FROM "ApiKey"
WHERE "revokedAt" IS NULL AND "siteId" IS NOT NULL AND NOT scopes <@ ARRAY['content:read'];
```

**Then.** `reachesSite` loses its special case for a missing Site id.

## Who owns a post's public URL: Easeia or each blog

**Today.** A post's public path is `/{categorySlug}/{slug}/`. Each blog computes it from its own `category-slugs.json`. Easeia computes the same path in `postPath` (`packages/sites/src/post-url.ts`) from `Site.categorySlugMap`, a copy of that file kept in sync by hand through the Site edit dialog, and from `Site.defaultCategory`. Easeia uses its copy for internal link suggestions, anchors in generated posts, Search Console matching and the dashboard. The daily `AUDIT_SLUG_DRIFT` tick (`apps/worker/src/handlers/audit-slug-drift.ts`) fetches each blog's sitemap and logs the posts whose live path differs from the derived one.

**Why it is open.** One rule has two owners, and when they disagree Easeia writes internal links that 404. Giving it one owner changes the build contract published as `@easeia/astro-content`, the theme, and every blog's deploy.

**Options.**

1. Easeia owns it. The build feed carries each post's path, the blogs render the post there, and `category-slugs.json` goes. Recommended: Easeia already chooses the category and the slug, and all twelve blogs run the same theme integration, so one loader release moves them together.
2. Each blog owns it. The blog publishes its map on deploy and Easeia reads it; `Site.categorySlugMap` becomes a cache nobody edits.
3. Leave both and keep the audit.

**Know first.** The last `AUDIT_SLUG_DRIFT` run should report no mismatched or missing posts before a cutover; its log event carries the counts per Site.

**Then.** The slug audit, its tick and the hand-edited map in the Site dialog can go, and the next entry has one place to change.

## Category names in the Site's language

**Today.** A post published without a category gets one stored at publish (`startPublish` in `packages/posts/src/transitions.ts`): the Site's most used category, or a name from `packages/posts/src/fallback-category.ts`, where every niche has a Portuguese name and the last resort is `Geral`. `Site.defaultCategory` defaults to `sem-categoria` (`packages/api-types/src/sites.ts`). English and Spanish Sites get the same Portuguese names.

**Why it is open.** The category is the first segment of the public URL. Posts already published keep their stored category, so their URLs stay; but a Site would start publishing under new category paths, and its blog has to know each new name in `category-slugs.json` before the first post uses it.

**Options.**

1. Names per `SiteLanguage`, for posts published from then on. English and Spanish Sites end up with both old Portuguese and new category paths unless the old posts are recategorised, which moves their URLs and needs redirects.
2. Leave it until the previous entry is decided, then do it once in the one place that owns the URL. Recommended.

**Know first.** How many non-Portuguese posts carry a Portuguese fallback name:

```sql
SELECT s.domain, s.language, p.categories[1] AS category, count(*)
FROM "Post" p JOIN "Site" s ON s.id = p."siteId"
WHERE s.language <> 'PT' GROUP BY 1, 2, 3 ORDER BY 1, 4 DESC;
```

## Converting stored post bodies to Markdown links

**Today.** A body is stored through `normalizeBody` (`packages/posts/src/normalize-body.ts`), which since #68 turns an inline `<a href>` into a Markdown link. Bodies written before that keep their HTML anchors until their next write. Readers accept both. `pnpm normalize:posts` (`tools/normalize-posts/index.ts`) prints, per Site, how many stored posts differ from their normalized form; with `--apply` it stores each one through `Posts.reviseBody`.

**Why it is open.** `--apply` rewrites production rows, and each live post it changes is embedded again, has its links crawled again and requests a redeploy of its Site.

**Options.**

1. Run the dry run, then `--apply`, at a quiet hour. Recommended: until it runs, no code may assume a stored body has one link syntax.
2. Let bodies convert as they are edited or rewritten. Old posts nobody touches never convert.

**Know first.** The dry run's counts: `pnpm normalize:posts` against production. Also unchecked: what the model writes now that the generate and rewrite prompts ask for Markdown links. `pnpm rewrite:eval` shows it and needs an OpenAI key; the missing-anchor check accepts either syntax, so a model that still writes `<a>` tags works and is normalized on write.

**Then.** Link checks can match an exact Markdown URL, and code that handles HTML anchors in a stored body can go.

## Which posts count as a Site's live posts

**Today.** `deployedWhere` (`packages/posts/src/build.ts`) is the definition the build feed uses: a post that is `PUBLISHED`, or was published before and is not `ARCHIVED`. A live post being republished is `SCHEDULED` until its `scheduledAt`, and stays in builds. Other readers use their own rule:

- `PUBLISHED` only, so a post drops out while it waits for a republish: link suggestion targets (`packages/links/src/suggest.ts`), the Search Console backfill (`apps/worker/src/handlers/backfill-gsc-links.ts`), the slug audit (`audit-slug-drift.ts`), `tools/enrich-internal-links` and `tools/fix-onpage-seo`.
- `publishedAt` only, so archived posts count: `postsLast7d`, `postsLast30d` and `daysSinceLastPublish` in `apps/worker/src/handlers/snapshot-site.ts`, which feed the health score, and the weekly publish chart in `apps/web/src/app/dashboard/sites/[id]/insights.ts`.

**Why it is open.** Each reader is a product choice: whether a post waiting for a republish is still a link target, and whether archiving a recent post should lower its Site's score.

**Options.**

1. Move the `PUBLISHED`-only readers to `deployedWhere`. Recommended: the post is on the live site the whole time.
2. For the `publishedAt` readers, keep counting what was published in the window, or count only what is still live. The second lowers the score of a Site that archived recent posts. Recommended: keep; the score measures publishing cadence.
3. Two readers should stay as they are: the hero sweep (`listHeroless` in `packages/posts/src/images.ts`), because the pending publish Job is about to generate that hero, and backfill membership (`packages/backfill/src`), which skips any member that is not `PUBLISHED` when it runs.

## The Google connection: per user or one for the workspace

**Today.** `GoogleConnection` is one row per user (`packages/search-console/src/tokens.ts`). Every Site uses the oldest row (`workspaceConnection` in `packages/search-console/src/search-console.ts`), and the settings page shows the viewer's own row. A second administrator's connection is stored and unused until the first disconnects, when it takes over without anyone being told.

**Why it is open.** It changes what each administrator sees and what disconnecting does, and one option rewrites stored rows.

**Options.**

1. One workspace connection that records who connected it. Disconnect acts on the shared connection and every administrator sees it. Existing rows collapse to the oldest, by a one-off script on production. Recommended if more than one person administers the instance.
2. Keep one row per user and show on the settings page which connection the workspace is using.
3. Leave it.

**Know first.** `SELECT count(*) FROM "GoogleConnection";` If it is 1, option 2 costs nothing and option 1 has nothing to collapse.

## One response envelope for the public API

**Today.** The routes in `apps/api/src/routes` answer in seven shapes: `{ data }`, `{ data, meta }`, `{ data, job }`, `{ link }`, `{ ok: true }`, bare `{ runId }` and bare `{ jobId }`.

**Why it is open.** N8N flows and other key holders read these shapes. Changing one breaks whoever reads it, and the repository cannot say who does.

**Options.**

1. One envelope, `{ data, meta? }`, in a new API version, with the current shapes kept until callers move.
2. One envelope in place, announced. Shortest, and breaks callers on the day.
3. Leave the shapes; they are declared in the OpenAPI document and each is stable. Recommended until there is a second reason to cut an API version.

**Know first.** Who calls the write routes: the `AuditLog` rows of API-key actors over the last 90 days, grouped by key and action.

## The password rule on the login form

**Today.** The login form validates its password with the rule for a new password, 12 characters or more (`loginSchema` in `apps/web/src/lib/form-schemas.ts`, bounds from `packages/auth/src/policy.ts`). The policy also exports `existingPassword`, which accepts any non-empty value and is meant for this form. A shorter password is refused in the browser with "Password must be at least 12 characters" and never reaches the server.

**Why it is open.** It is sign-in behaviour in a live product. Under today's rule, an account whose password is shorter than 12 characters cannot sign in at all.

**Options.**

1. Use `existingPassword` on the login form. The server decides, and a wrong password of any length gets the same generic failure. Recommended.
2. Keep the 12-character rule. It saves one request for a password that cannot be right, as long as no account was ever created under a shorter minimum.

**Know first.** Whether any account predates the 12-character minimum. Passwords are hashed, so the database cannot say; the history of `PASSWORD_LENGTH` and of the seed scripts can.

## Site reachability: probed on every page view or read from the snapshot

**Today.** The worker's daily snapshot probes each Site and stores `reachable` on `SiteSnapshot` (`apps/worker/src/handlers/snapshot-site.ts`). The Site page probes the Site again on every render (`apps/web/src/app/dashboard/sites/[id]/insights.ts`), with its own timeout. The backlink score curve also exists twice, in the snapshot handler and in `packages/health/src/score.ts`.

**Why it is open.** Giving the snapshot one owner means the Site page shows the stored value, up to a day old, where it shows a live answer today.

**Options.**

1. The Site page reads the snapshot and offers a "check now" action that runs the snapshot Job. One probe, one curve, and a page that does not wait on a third-party site to render. Recommended.
2. Keep the live probe on the page and share the probe function between the two callers.
3. Leave it.

**Then.** With option 1, a single module can collect from DataForSEO, Search Console and the health score, write the row and serve the dashboard.

## What the WordPress migration left in stored bodies

**Today.** Two branches exist only for posts imported from WordPress: `toMarkdown` strips Gutenberg block comments (`GUTENBERG` in `packages/posts/src/to-markdown.ts`), and the rewrite guard skips its growth check for bodies under 2000 characters because the migration left short stubs (`RATIO_APPLIES_ABOVE_CHARS` in `packages/rewrite/src/guard.ts`).

**Why it is open.** Whether either still has anything to act on is a fact about production data.

**Know first.**

```sql
SELECT count(*) FROM "Post" WHERE body ~ '<!--\s*/?wp:';
SELECT count(*) FROM "Post" WHERE length(body) < 2000 AND status <> 'ARCHIVED';
```

**Options.** If the first count is 0, delete the Gutenberg branch; a body pasted from WordPress through the API would then keep its block comments, so keep the branch if that is still a way posts arrive. If the second count is 0 or only holds posts that are short on purpose, apply the growth check to every body.

## The name of `WP_ENCRYPTION_KEY`

**Today.** The key encrypts Google OAuth tokens at rest and nothing else; the WordPress credentials it was named for are gone. Web and the worker need the same value. `packages/search-console/src/crypto.ts` reads `process.env.WP_ENCRYPTION_KEY` itself, the worker's env schema requires it, and web's does not mention it.

**Why it is open.** A rename has to happen in the hosted web and worker settings and in every self-hosted `.env.selfhost` at the same deploy. A missed one stops the worker at boot and breaks Search Console in web. No stored data changes, because the value stays.

**Options.**

1. Leave the name and keep the comments accurate. Recommended: the name is wrong and costs nothing.
2. Rename it, for example to `TOKEN_ENCRYPTION_KEY`, with an Upgrade step in `docs/self-hosting.md`, on a day another required setting changes anyway.

## Packages that read the environment, and the shared database client

**Today.** `packages/db/src/client.ts` builds one Prisma client from `process.env.DATABASE_URL`, and 113 files across the apps, packages and tools import it. The fleet standard asks a package to take values from the app that parsed them; Easeia holds a waiver for the two database-client rules. Five more packages read `process.env` themselves: `ai` (the OpenAI key and the budget settings), `blob` (R2), `dataforseo` (credentials), `jobs` (`REDIS_URL`) and `search-console` (the encryption key and the Google OAuth client).

**Why it is open.** For the database client, taking a value means every domain function receives a client or every app builds one composition root, which touches most of the codebase. It changes no behaviour, so the question is only whether the cost is worth paying.

**Options.**

1. Convert the five small packages one at a time: each exports a function that takes its config, and web, api and worker pass values from their env schemas. Keep the database client waived. Recommended: each is a few call sites, and a missing variable then fails at boot in the app's schema, not on first use.
2. Convert the database client too and drop the waiver.
3. Leave all six.

## `backfill:body-images` writes unless told not to

**Today.** `tools/backfill-body-images/index.ts` generates and stores images unless given `--dry-run`. Every other tool that writes (`normalize-posts`, `enrich-internal-links`, `fix-onpage-seo`, `merge-tag-variants`, `maintenance/regenerate-heroes.ts`) does nothing without `--apply`. A run costs about 0.17 USD a post.

**Why it is open.** It changes how a paid tool is invoked.

**Options.**

1. Dry run by default, `--apply` to write, like the others. Recommended.
2. Leave it; the README of the tool says so.

## The root package name

**Today.** The root `package.json` is named `easeia-monorepo`, the repository's name. The identity slug, the Portless names, the compose project and the cookie prefix say `easeia`. The root name is rendered nowhere.

**Options.** Rename it to `easeia`, or leave it. Recommended: leave it; it matches the repository and nothing reads it.
