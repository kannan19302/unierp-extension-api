/**
 * Extension Contract Version Specification
 * Phase P12-079: Extension API contract.
 *
 * Requirements:
 * - 3 years mandatory support window for extension API contract versions.
 * - 12 months minimum deprecation notice before sunset.
 * - Host runtime backward-compatibility adapter for older supported contract versions.
 */

export interface ExtensionApiVersionSpec {
  contractVersion: string;
  releaseDate: string; // ISO8601
  status: "ACTIVE" | "DEPRECATED" | "RETIRED";
  deprecationDate?: string;
  sunsetDate?: string;
  minSupportedHostVersion: string;
}

export const CANONICAL_EXTENSION_API_VERSIONS: ExtensionApiVersionSpec[] = [
  {
    contractVersion: "1.0.0",
    releaseDate: "2026-01-01T00:00:00Z",
    status: "ACTIVE",
    minSupportedHostVersion: "1.0.0",
  },
];

export class UnsupportedExtensionContractVersionError extends Error {
  constructor(public readonly requestedVersion: string, public readonly supportedVersions: string[]) {
    super(
      `Extension was compiled against unsupported extension-api contract version '${requestedVersion}'. Supported contract versions are: ${supportedVersions.join(
        ", "
      )}.`
    );
    this.name = "UnsupportedExtensionContractVersionError";
  }
}

export function assertExtensionContractCompatibility(
  manifestContractVersion: string,
  currentHostDate: Date = new Date("2026-08-14T00:00:00Z")
): { isCompatible: boolean; versionSpec: ExtensionApiVersionSpec } {
  const versionSpec = CANONICAL_EXTENSION_API_VERSIONS.find(
    (v) => v.contractVersion === manifestContractVersion
  );

  if (!versionSpec) {
    throw new UnsupportedExtensionContractVersionError(
      manifestContractVersion,
      CANONICAL_EXTENSION_API_VERSIONS.map((v) => v.contractVersion)
    );
  }

  if (versionSpec.status === "RETIRED") {
    throw new UnsupportedExtensionContractVersionError(
      manifestContractVersion,
      CANONICAL_EXTENSION_API_VERSIONS.filter((v) => v.status !== "RETIRED").map((v) => v.contractVersion)
    );
  }

  // If deprecated, verify if current host date is still within the sunset window
  if (versionSpec.status === "DEPRECATED" && versionSpec.sunsetDate) {
    const sunset = new Date(versionSpec.sunsetDate);
    if (currentHostDate.getTime() > sunset.getTime()) {
      throw new UnsupportedExtensionContractVersionError(
        manifestContractVersion,
        CANONICAL_EXTENSION_API_VERSIONS.filter((v) => v.status === "ACTIVE").map((v) => v.contractVersion)
      );
    }
  }

  return { isCompatible: true, versionSpec };
}
