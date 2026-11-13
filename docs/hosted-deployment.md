# Hosted deployment

How the hosted instance (`app.easeia.com`, `api.easeia.com`, `www.easeia.com`) builds, starts and receives a schema change. Self-hosting is in [self-hosting.md](self-hosting.md).

## Services

Every merge to `main` deploys all four. Nothing is deployed by hand.

| Service   | Host    | Build                                         | Pre-deploy                                                           | Start                        |
| --------- | ------- | --------------------------------------------- | -------------------------------------------------------------------- | ---------------------------- |
| `web`     | Vercel  | project `easeia-web`, root `apps/web`         | none                                                                 | Vercel                       |
| `landing` | Vercel  | project `easeia-landing`, root `apps/landing` | none                                                                 | Vercel                       |
| `api`     | Railway | `pnpm exec turbo run build --filter=api`      | `DATABASE_URL="$DIRECT_DATABASE_URL" pnpm --filter @repo/db db:push` | `pnpm --filter api start`    |
| `worker`  | Railway | `pnpm exec turbo run build --filter=worker`   | none                                                                 | `pnpm --filter worker start` |

The Railway services use the default Railpack builder. Their commands are set in the Railway service settings, not in a file in this repository, so change this table when you change them. The health-check path of each service is also set there and is not recorded here.

Each deploy reports a commit status on the merge commit: `easeia - api`, `easeia - worker`, `Vercel – easeia-web` and `Vercel – easeia-landing`.

```sh
gh api repos/unlockers-io/easeia-monorepo/commits/<sha>/statuses --jq '.[] | "\(.context) \(.state)"'
curl -s -o /dev/null -w '%{http_code}\n' https://app.easeia.com/api/auth/ok
curl -s -o /dev/null -w '%{http_code}\n' https://api.easeia.com/readyz
```

## How a schema change reaches production

The api's pre-deploy command runs `prisma db push` against production on every api deploy, without `--accept-data-loss`. There are no migration files.

- A change that only adds (a nullable column, a table, an index, an enum value) applies itself when the api deploys.
- A change that would lose data (dropping a column or table that holds values, removing an enum value in use, changing a column's type) is refused. The api deploy fails and the previous api build keeps serving. Web and the worker have no pre-deploy command, so they deploy the new code anyway and run it against the old schema.

A red `easeia - api` status right after a schema change is this refusal until shown otherwise. Nothing merged to the api is live while it lasts.

## Dropping a column

Prisma names every column its generated client knows in the queries it writes. Dropping a column under a build whose client still declares the field breaks that build's reads and writes of the whole model. Removing the field first does not work either: `db push` refuses the drop, the api deploy fails, and the previous api build, which still names the column, is the one serving.

The order with no window:

1. **Stop using the column, keep it declared.** One pull request removes every read and write of the field and marks it `@ignore` in `packages/db/prisma/schema.prisma`, with a `shortcut:` comment. The generated client no longer names the column and `db push` reports the database in sync. Merge it and wait until all four deploys of the merge commit succeed.
2. **Drop the column by hand on production.** Back the column up first, then:

   ```sql
   BEGIN;
   SET LOCAL lock_timeout = '5s';
   ALTER TABLE "<Model>" DROP COLUMN "<column>";
   COMMIT;
   ```

3. **Delete the field.** A second pull request deletes the `@ignore` field and adds the same SQL to the Upgrade section of [self-hosting.md](self-hosting.md), since a self-hosted database holds the column too. `db push` reports the database in sync.

If the api redeploys between steps 2 and 3, `db push` adds the column back, empty; step 3 then drops the empty column without asking.

The same order applies to anything else `db push` refuses: make the running builds stop depending on it, change production by hand, then change the schema. `Post.featuredImage` was dropped this way in #67 and #74. On a throwaway database, the build before #67 failed 73 tests once the column was gone, and the build after #67 passed every suite with the column present and with it dropped.
