import { z } from "zod";

/**
 * The capability model — PLATFORM_ARCHITECTURE.md § 8.3, TRD ADR-009.
 *
 * Extension code receives **no ambient authority**. It cannot `require`, cannot
 * reach `process`, `fetch` or the filesystem, and holds no Prisma handle. Every
 * operation it can perform is a host function explicitly granted by a scope in
 * its manifest, and every one of those runs on the host side of an isolate
 * boundary where the tenant is re-derived from the installation rather than
 * read from anything the extension said.
 *
 * A scope is `domain:action` — `data:read`, `http:fetch`. The wildcard `*` is
 * deliberately NOT supported: the § 1.2 escalation in this codebase happened
 * because a wildcard grant satisfied a check it was never meant to satisfy, and
 * repeating that shape in the partner-facing surface would be the same mistake
 * with a larger blast radius.
 */
export const SCOPES = [
  "data:read",
  "data:write",
  "http:fetch",
  "jobs:schedule",
  "events:subscribe",
  "log:write",
] as const;

export type Scope = (typeof SCOPES)[number];

export const ScopeSchema = z.enum(SCOPES);

/**
 * Resource budget for one extension in one tenant. Every field is a hard stop,
 * not a target — § 8.3 requires metering with quotas, circuit breakers and a
 * kill switch reachable from the Platform Admin Console.
 */
export const ResourceBudgetSchema = z.object({
  /** Hard V8 heap cap for the isolate, in MB. */
  memoryMb: z.number().int().min(8).max(512).default(32),
  /** Wall-clock deadline for a single synchronous entry, in ms. */
  timeoutMs: z.number().int().min(10).max(30_000).default(1_000),
  /** Total CPU milliseconds the extension may consume before it is cut off. */
  cpuMsPerMinute: z.number().int().min(100).max(60_000).default(5_000),
  /** Database reads/writes permitted per invocation. */
  queriesPerInvocation: z.number().int().min(0).max(1_000).default(50),
  /** Outbound HTTP requests permitted per invocation. */
  httpCallsPerInvocation: z.number().int().min(0).max(100).default(10),
});

export type ResourceBudget = z.infer<typeof ResourceBudgetSchema>;

/**
 * Hosts this extension may reach over HTTP. § 8.3: "outbound HTTP only to
 * manifest-declared, admin-approved hosts." Declared here, approved separately
 * at install time — a manifest cannot approve itself.
 */
export const EgressRuleSchema = z.object({
  host: z.string().min(1),
  /** Approved by the installing tenant admin. Declared-but-unapproved is denied. */
  approved: z.boolean().default(false),
});

export type EgressRule = z.infer<typeof EgressRuleSchema>;

export const ExtensionManifestV1Schema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]{2,63}$/, "id must be kebab-case"),
  name: z.string().min(1),
  version: z.string().regex(/^\d+\.\d+\.\d+$/, "version must be SemVer"),
  description: z.string().optional(),
  publisher: z.string().min(1),
  /** Scopes requested. The effective grant is the intersection with the installer's own permissions. */
  scopes: z.array(ScopeSchema).default([]),
  entryPoint: z.string().min(1),
  budget: ResourceBudgetSchema.default({}),
  egress: z.array(EgressRuleSchema).default([]),
  /** Declarative model extensions — generated into the extension namespace (§ 8.2). */
  schema: z.unknown().optional(),
});

export type ExtensionManifestV1 = z.infer<typeof ExtensionManifestV1Schema>;

/**
 * The effective grant for one installation.
 *
 * § 5.2: "scopes are the intersection of (grant, installing admin's
 * permissions, extension's declared manifest scopes)" — an extension can never
 * exceed the permissions of the admin who installed it. This function is that
 * rule, in one place, so it cannot be re-implemented differently per call site.
 */
export function effectiveScopes(
  requested: readonly Scope[],
  installerScopes: readonly Scope[],
): Scope[] {
  const installer = new Set(installerScopes);
  return requested.filter((s) => installer.has(s));
}
