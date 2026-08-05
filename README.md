# unierp-extension-api

**Layer L2 — Runtime** of the [UniERP](../unierp-platform) platform.
Depends on: L0, L1.

## What this is

The public contract customer code compiles against: manifest schema, extension points, capability scopes, resource budgets, signed-bundle format.

## The invariant this repository owns

**3 years' support, 12 months' deprecation notice.** Its own repository because that promise outlives any platform release. Scopes are the intersection of what the manifest requests and what the installing admin actually holds — an extension can never exceed its installer.

## The rule that applies everywhere

A repository may depend only on published artifacts of a **strictly lower
layer** — never sideways within a layer, never upward. A cycle is not
discouraged; it is unrepresentable, because the lower layer's package cannot
name the higher one.

See the [platform overview](../unierp-platform/README.md) for the full map, and
[`PLATFORM_ARCHITECTURE.md`](../ERPSys/docs/PLATFORM_ARCHITECTURE.md) § 4.2 for
the reasoning.

## Licence

AGPL-3.0.
