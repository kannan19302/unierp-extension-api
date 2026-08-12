/**
 * G01 exit criterion: "Every capability is explicitly granted; anything not
 * granted is unreachable, proven by test. A capability cannot be added
 * without a version bump."
 *
 * `ExtensionManifestSchema`/`ExtensionManifest` used to live here as a
 * SEPARATE, older, permissive schema (`permissions: z.array(z.string())` —
 * any string accepted, no closed scope enum) alongside the real, correct,
 * closed model (`ExtensionManifestV1Schema` in ./capabilities, which uses
 * the closed `ScopeSchema` enum and is the only one unierp-api's
 * extension-registry.service.ts actually validates against — confirmed via
 * grep, it never imports this one). Two competing, drifting definitions of
 * the same manifest shape in one public package, one of them permissive and
 * unused by the only real consumer — deleted rather than kept as a trap for
 * a future integrator who imports the wrong one.
 */

/**
 * The capability surface handed to extension code.
 *
 * Deliberately an interface rather than `Record<string, any>`: this is the
 * public contract partners compile against (PLATFORM_ARCHITECTURE § 8.2), and
 * its compatibility promise — 3 years' support, 12 months' deprecation notice —
 * is meaningless if the shape is `any`. Extend it explicitly as capabilities
 * are granted; each addition is a versioned change to the public API.
 *
 * Previously had `[capability: string]: unknown` — an OPEN index signature
 * accepting any string key, directly contradicting this phase's own exit
 * criterion ("anything not granted is unreachable, proven by test"): the
 * TYPE ITSELF declared every possible capability name reachable, regardless
 * of scope grants. `log` (log:write) is the only capability with a
 * confirmed host-function implementation anywhere in this codebase — the
 * other 5 scopes in SCOPES (data:read, data:write, http:fetch,
 * jobs:schedule, events:subscribe) have no corresponding runtime binder
 * confirmed to exist, so they are deliberately NOT added here as typed
 * members yet — adding a fabricated method signature with no real
 * implementation behind it would be exactly the kind of unproven claim this
 * whole programme exists to eliminate. Closed now; grows one explicit,
 * version-bumped member at a time as each capability's real host function
 * is actually built.
 */
export interface ExtensionApi {
  /** Structured log line, attributed to the extension and its tenant. */
  log: (message: string, meta?: Record<string, unknown>) => void;
}

export interface ExtensionContext {
  api: ExtensionApi;
  tenantId: string;
}

/** Minimal request/response shape for an extension-mounted route. */
export interface ExtensionRequest {
  params?: Record<string, string>;
  query?: Record<string, string>;
  body?: unknown;
}

export interface ExtensionResponse {
  json: (body: unknown) => void;
  status?: (code: number) => ExtensionResponse;
}

export interface Extension {
  onInstall?: (context: ExtensionContext) => Promise<void>;
  onEnable?: (context: ExtensionContext) => Promise<void>;
  onDisable?: (context: ExtensionContext) => Promise<void>;
  onUninstall?: (context: ExtensionContext) => Promise<void>;
  customRoutes?: Record<
    string,
    (req: ExtensionRequest, res: ExtensionResponse) => Promise<void>
  >;
}

export type ExtensionFactory = (context: ExtensionContext) => Extension;

export * from "./capabilities.js";
export * from "./schema.js";
export * from "./bundle.js";
