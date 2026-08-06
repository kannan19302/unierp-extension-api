import { z } from "zod";

/**
 * Signed extension bundles — PLATFORM_ARCHITECTURE.md § 8.2 ("An extension is a
 * signed bundle") and § 10 ("Every published package is signed and
 * provenance-attested").
 *
 * The threat this closes is not an extension behaving badly once installed —
 * the sandbox handles that. It is an extension being *modified between publish
 * and install*: a compromised registry, a man-in-the-middle on the download, or
 * a tampered file on disk. Without a signature, the sandbox faithfully isolates
 * whatever code arrives, including code the publisher never wrote.
 *
 * Design notes:
 *
 *   - **The digest covers the manifest too**, not only the code. Signing the
 *     code alone would let an attacker keep a valid code signature while
 *     rewriting the manifest to request `data:write` and a new egress host.
 *     Scopes are part of what is signed, so they cannot be escalated in transit.
 *   - **Canonical serialisation.** The digest is computed over a deterministic
 *     encoding, so re-serialising the same bundle produces the same digest and
 *     a signature does not break on key ordering or whitespace.
 *   - **Ed25519.** Small keys, small signatures, no parameter choices to get
 *     wrong, and available in Node's standard library — no new dependency, per
 *     the open-source mandate in TRD Requirement 0.
 */

export const BUNDLE_SIGNATURE_ALGORITHM = "ed25519" as const;

export const BundleFileSchema = z.object({
  path: z.string().min(1).max(512),
  /** SHA-256 of the file's bytes, lowercase hex. */
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  bytes: z.number().int().nonnegative(),
});

export type BundleFile = z.infer<typeof BundleFileSchema>;

export const BundleSignatureSchema = z.object({
  algorithm: z.literal(BUNDLE_SIGNATURE_ALGORITHM),
  /** Publisher key identifier — which key to verify against. */
  keyId: z.string().min(1),
  /** Base64 signature over the canonical digest. */
  signature: z.string().min(1),
  signedAt: z.string().datetime(),
});

export type BundleSignature = z.infer<typeof BundleSignatureSchema>;

export const SignedBundleSchema = z.object({
  manifest: z.record(z.unknown()),
  files: z.array(BundleFileSchema).min(1),
  signature: BundleSignatureSchema,
});

export type SignedBundle = z.infer<typeof SignedBundleSchema>;

/**
 * Deterministic JSON encoding: object keys sorted at every depth, no
 * insignificant whitespace. Two structurally equal values always encode to the
 * same string, which is what makes a digest reproducible across publishers,
 * languages and re-serialisation.
 */
export function canonicalise(value: unknown): string {
  if (value === null || typeof value !== "object")
    return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(canonicalise).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalise(v)}`).join(",")}}`;
}

/**
 * The bytes a publisher signs and a verifier checks.
 *
 * Covers the manifest and the full file list with their hashes, so changing any
 * file's content, adding a file, removing one, or editing the manifest all
 * invalidate the signature.
 */
export function bundleDigestInput(bundle: {
  manifest: unknown;
  files: readonly BundleFile[];
}): string {
  return canonicalise({
    manifest: bundle.manifest,
    files: [...bundle.files]
      .map((f) => ({ path: f.path, sha256: f.sha256, bytes: f.bytes }))
      .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0)),
  });
}

/** A publisher's registered verification key. */
export const PublisherKeySchema = z.object({
  keyId: z.string().min(1),
  publisher: z.string().min(1),
  /** SPKI DER public key, base64. */
  publicKey: z.string().min(1),
  revoked: z.boolean().default(false),
});

export type PublisherKey = z.infer<typeof PublisherKeySchema>;
