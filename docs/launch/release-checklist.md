# Public release checklist

The current repository must remain private: old commits contain operator-specific domains, database identifiers, and storage URLs that were removed from the current tree. Making the existing history public would expose them again.

## Prepared changes

- MIT and community files; synthetic examples in source and launch captures.
- Docker Compose first-run path with the schema service and a first-user registration gate.
- Literal self-hosting and Cloud-waitlist copy, plus the Astro integration guide.
- Release workflow uses npm OIDC with provenance. No long-lived npm token is passed.
- A Changeset prepares the Astro adapter’s next patch release (0.5.1 from 0.5.0).
- Dependency audit runs on pull requests, main, weekly, and manual dispatch.

## Repository replacement: owner confirmation required

Review the full final tree and phase PRs first. The recommended path is a fresh repository with a single initial commit, preserving the canonical URL used by the published package:

1. Merge the reviewed phase changes or close their PRs and freeze the private repository. Resolve any new branches created during review; do not discard unrelated work.
2. Back up Git refs and repository settings privately. Export **only the reviewed commit’s tracked files** to a separate directory. Run the scrub and secret scans against that export and verify it contains no env files, dependencies, build caches, private notes, or prior Git history.
3. Create a new local Git repository from that export with exactly one commit, `Initial public release`. The working branch in the original checkout is not renamed or rewritten.
4. **After explicit owner confirmation**, rename the old GitHub repository to `easeia-monorepo-archive` and keep it private. Create a new private `unlockers-io/easeia-monorepo`, initially with Actions disabled, and push only the prepared initial commit. Do not push old branches or tags.
5. Restore CODEOWNERS review, branch protection/rulesets and required checks, Discussions, repository description/topics, and the optional `RESEND_API_KEY_TEST` secret. Do not copy obsolete production or npm-token secrets.
6. Review the GitHub source tree again, then make the fresh repository public. The old archive remains private. Enable Actions after configuring the publisher and reviewing the pending release.

Changing names affects clones, open links, integrations, and repository settings. The archive is a backup, not a way to undo external exposure if history is published accidentally. A history-filtering approach would require a separate purge plan and is not part of this prepared flow.

## npm trusted publisher and patch verification

In npm’s settings for `@easeia/astro-content`, configure the GitHub Actions trusted publisher for:

- Organization: `unlockers-io`
- Repository: `easeia-monorepo`
- Workflow filename: `release.yml`
- Environment: leave blank unless a matching GitHub environment is added to the release job.

The workflow runs on Node 24, with `id-token: write` and `NPM_CONFIG_PROVENANCE=true`. Confirm its npm version supports trusted publishing (11.5.1 or newer). No `NPM_TOKEN` or `NODE_AUTH_TOKEN` should be needed.

Review the Changesets version PR and wait for lint, formatting, dead-code, typecheck, unit tests, E2E, and audit. Publishing is an external release and needs owner approval. After the approved patch release, verify the npm version, provenance link to the new repository, packaged LICENSE/README, and install/build the adapter in an Astro consumer. Local pack validation does not prove npm’s OIDC account configuration.

## Hosted launch checks

- Set the existing operator instance to `SIGNUP_MODE=closed` before directing visitors to it. Never invite waitlist users into this shared admin database.
- Configure the landing’s `NEXT_PUBLIC_API_URL` and API `CORS_ORIGINS` for `https://easeia.com`; apply the schema before enabling the form.
- Enable `NEXT_PUBLIC_ENABLE_ANALYTICS=true` only on the hosted marketing deployment if Vercel Analytics is desired.
- Confirm public `/openapi.json`, `/docs`, and `/llms.txt` include sites, money sites, network operations, and waitlist. Browser-check Scalar and the waitlist round trip on the deployed hosts.
- Verify `hello@easeia.com` receives mail, with an actual delivery check by the owner. DNS records alone do not establish inbox delivery.
- Review the synthetic screenshot gallery and launch copy, then submit manually to Hacker News and Product Hunt.

No repository replacement, visibility change, package release, production schema change, or launch submission is performed by this checklist.
