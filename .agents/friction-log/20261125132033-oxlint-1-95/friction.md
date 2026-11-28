---
title: 'oxlint 1.95 needs a newer tsrs, and pnpm trustPolicy blocks every newer tsrs and prisma 7.10.1'
severity: 'minor'
issue: 'unlockers-io/easeia-monorepo#81'
---

### Expected Behavior

`oxlint` can be bumped to its latest release on its own, like any other dev dependency.

### Current Behavior

With `oxlint` 1.95.0 and `tsrs` 0.25.0-ts7.1.0-beta, `pnpm lint` exits 1 before linting anything: `Error running tsgolint: "exit status: exit status: 1, error: error running linter: unknown rule: no-unsafe-class-instance-assignment"`. The newer `tsrs` releases that know the rule fail `trustPolicy: no-downgrade` (`ERR_PNPM_TRUST_DOWNGRADE`), because `trustPolicyExclude` lists `tsrs` at one exact version. `prisma` 7.10.1 fails the same policy, so the Prisma packages stay on 7.10.0 too.

### Possible Solution

Bump `oxlint` and `tsrs` together, and move the `tsrs` and `prisma` entries in `trustPolicyExclude` to the new versions in the same change.

### Minimal Reproducible Example

`pnpm up -w oxlint@1.95.0 && pnpm lint`, then `pnpm up -w tsrs@7.1.0-beta.tsrs5`.

### Context

Hit while updating all the dependencies. `oxlint` stays on 1.94.0, `tsrs` on 0.25.0-ts7.1.0-beta and `prisma` on 7.10.0 until the exclusions are updated.
