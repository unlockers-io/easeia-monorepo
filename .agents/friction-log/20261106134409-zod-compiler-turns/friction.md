---
title: 'zod-compiler turns Hono validation failures into a thrown undefined'
severity: 'minor'
issue: 'unlockers-io/easeia-monorepo#41'
---

### Expected Behavior

A request body that fails a route's zod schema answers 400 with the `VALIDATION_ERROR` envelope.

### Current Behavior

When zod-compiler compiles the schema, the request throws `undefined` and the test reports `Unknown Error: undefined`. `@hono/zod-validator` spreads the `safeParse` result into the hook; a compiled result keeps `error` as a non-enumerable getter, so `defaultHook` in `apps/api/src/lib/openapi.ts` throws `undefined` and Hono's `onError` never runs.

### Possible Solution

Read the error without spreading in `defaultHook` (re-run `schema.safeParse`), or keep the exclusion globs in one module that `apps/api/vitest.config.ts` and `apps/api/tsdown.config.ts` both import.

### Minimal Reproducible Example

Drop the `exclude` option from `apps/api/vitest.config.ts` and run `pnpm --filter api test`: the two invalid-body cases in `src/routes/suggestions.test.ts` fail with `Unknown Error: undefined`.

### Context

Moving the api's zod-compiler exclusions out of `@repo/config-vitest` silently dropped them for api tests; nothing failed until a test sent an invalid body to a route whose schema comes straight from `@repo/api-types`.
