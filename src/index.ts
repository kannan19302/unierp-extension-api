import { z } from "zod";

export const ExtensionManifestSchema = z.object({
  id: z.string(),
  name: z.string(),
  version: z.string(),
  description: z.string().optional(),
  permissions: z.array(z.string()),
  entryPoint: z.string(),
});

export type ExtensionManifest = z.infer<typeof ExtensionManifestSchema>;

/**
 * The capability surface handed to extension code.
 *
 * Deliberately an interface rather than `Record<string, any>`: this is the
 * public contract partners compile against (PLATFORM_ARCHITECTURE § 8.2), and
 * its compatibility promise — 3 years' support, 12 months' deprecation notice —
 * is meaningless if the shape is `any`. Extend it explicitly as capabilities
 * are granted; each addition is a versioned change to the public API.
 */
export interface ExtensionApi {
  /** Structured log line, attributed to the extension and its tenant. */
  log: (message: string, meta?: Record<string, unknown>) => void;
  /** Additional capabilities are granted per the manifest's declared scopes. */
  [capability: string]: unknown;
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

export * from "./capabilities";
export * from "./schema";
export * from "./bundle";
