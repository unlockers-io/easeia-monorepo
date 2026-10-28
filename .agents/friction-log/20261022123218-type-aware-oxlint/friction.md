---
title: 'Type-aware oxlint rejects jest-dom matchers in apps/web tests'
severity: 'minor'
issue: 'unlockers-io/easeia-monorepo#36'
---

## Expected Behavior
jest-dom matchers such as `toBeEnabled` and `toBeDisabled` type-check in `apps/web` tests, since `@repo/config-vitest/setup-react` imports `@testing-library/jest-dom/vitest` at runtime.

## Current Behavior
`pnpm lint` fails with `typescript(TS2339): Property 'toBeEnabled' does not exist on type 'Assertion<void, HTMLElement>'` in `apps/web/src/app/dashboard/settings/password-form.test.tsx`. The test passes under vitest. Asserting on `HTMLButtonElement.disabled` works around it.

## Possible Solution
Add `@testing-library/jest-dom/vitest` to the types the web (and ui) tsconfig sees, for example a `vitest.d.ts` with `import "@testing-library/jest-dom/vitest";` or a `types` entry, so type-aware lint and tsc agree with the runtime setup.

## Minimal Reproducible Example
Write `expect(screen.getByRole("button")).toBeEnabled();` in any `apps/web/src/**/*.test.tsx` and run `pnpm lint`.

## Context
Hit while migrating forms to validate on submit and then on every change; the test asserts the submit button stays enabled while the form is invalid.
