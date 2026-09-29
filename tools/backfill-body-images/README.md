# Backfill body images

Enqueues `GENERATE_BODY_IMAGES` for published posts whose bodies have no images. Body images are disabled by default. Set `BODY_IMAGES_ENABLED=true` on the worker to process these jobs or generate body images automatically for new posts.

Four medium-quality images cost about $0.16 in output tokens, plus prompt tokens and the placement planner. Each job rewrites a live post body and consumes the shared AI allowance once enforcement is active. Pass `--limit` to bound a run or `--all` to scan every eligible post. `--dry-run` reports candidates without enqueueing them.

```bash
pnpm -w backfill:body-images --dry-run --limit 20
pnpm -w backfill:body-images --limit 20
pnpm -w backfill:body-images --all --site <siteId>
```

Requires `DATABASE_URL`; actual enqueueing also requires `REDIS_URL`. Check the target environment before running against the live network.
