const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  CANONICAL_EXTENSION_API_VERSIONS,
  assertExtensionContractCompatibility,
  UnsupportedExtensionContractVersionError,
} = require("../dist/versioning.js");

describe("Extension API Contract Compatibility (P12-079)", () => {
  it("validates that active contract versions are supported", () => {
    const res = assertExtensionContractCompatibility("1.0.0");
    assert.equal(res.isCompatible, true);
    assert.equal(res.versionSpec.contractVersion, "1.0.0");
  });

  it("throws UnsupportedExtensionContractVersionError when an unknown version is specified", () => {
    assert.throws(
      () => assertExtensionContractCompatibility("0.1.0-alpha"),
      (err) => {
        assert.ok(err instanceof UnsupportedExtensionContractVersionError);
        assert.ok(err.message.includes("unsupported extension-api contract version '0.1.0-alpha'"));
        return true;
      }
    );
  });
});
