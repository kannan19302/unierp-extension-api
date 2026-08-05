# unierp-extension-api

**Layer L2** of the UniERP layered repository architecture
(`PLATFORM_ARCHITECTURE.md` § 4.2). Publishes @unerp/extension-api.

## Why it is its own repository

The public contract customer code compiles against, plus the sandbox host interface. **3-year support, 12-month deprecation.** Its own repository because its promise outlives any platform release (§ 4.2).

## The invariant

**A repository may depend only on published artifacts of a strictly lower
layer. Never sideways within a layer. Never upward.** A cycle is not
discouraged — it is unrepresentable, because the lower layer's package cannot
name the higher one.

## Extraction status

Extracted from the `ERPSys` monorepo as § 14 Phase 3, with history preserved
via `git-filter-repo`.

**The monorepo copy remains authoritative.** Consumers switch to published
packages only once those packages are publishable; the monorepo stays buildable
at each extraction tag until they do. Rollback is a one-line `pnpm` override
pointing consumers back at the workspace path.
