# ADR-0001: Site is the principal aggregate

> Historical context: the WordPress publishing channel has been removed. Its channel-specific details are superseded by the Astro build API.
> **Status:** accepted (2026-05-05)

## Context

A WordPress install in our network is identified by `domain` and carries
encrypted credentials, an SEO plugin choice, niches, and an enabled flag.
Several places need to talk to a remote WordPress: the worker (publish,
unpublish, sync), `tools/seed` (provision creds), the public REST API
(read-only projection), and the admin (CRUD over the row).

Before this decision the encrypted credential lived on the row, and every
caller was responsible for:

1. Loading the row.
2. Decrypting `apiPassword`.
3. Constructing a `WpClient`.
4. Stripping the password before returning the row in any response.

That's four responsibilities scattered across three apps, with no obvious
home for "what happens before we touch a Site" (e.g. the `isEnabled`
check, future per-Site rate limits, audit logging on credential reads).

## Decision

The Site is the **principal aggregate** of the domain. We introduce
`@repo/sites` as the single Module that:

- Loads Sites (`load`, `list`).
- Encrypts/decrypts credentials (`upsert`, internal `crypto.ts`).
- Strips credentials for any public projection.
- Constructs a configured `WpClient` (`clientFor`).
- Owns the `isEnabled` gate.

No other code in the repository may:

- Import `apiPassword` plaintext.
- Construct a `WpClient` directly.
- Encrypt or decrypt secrets (this is what `@repo/crypto` did before; the
  primitive is now internal to `@repo/sites`).

Tools/seed, the API route, the worker handler, and the admin server
actions all call the same five functions.

## Consequences

- **Locality.** All credential handling lives in one place. Adding a key
  rotation flow, an audit hook on every decrypt, or a per-Site rate
  limiter is a one-file change.
- **Leverage.** Callers shrink: the worker handler dropped from explicit
  decrypt + `new WpClient(...)` to a single `Sites.clientFor(siteId)`.
- **Test surface.** The Sites module is the test surface for "WP
  credential lifecycle": there's exactly one place to seed fixtures.
- **Obsolete:** `@repo/crypto` was deleted; its two functions live as
  internal `crypto.ts` in `@repo/sites`.

## Alternatives considered

- **Keep `@repo/crypto` separate.** Rejected: it had no substitutability,
  no internal complexity, and its only consumers all touched Sites
  anyway. Hypothetical seam (one adapter only).
- **Repository pattern with a generic `SiteRepo`.** Rejected: would not
  cover the `WpClient` construction or the `isEnabled` gate, and adds an
  abstraction layer the codebase doesn't earn yet.
