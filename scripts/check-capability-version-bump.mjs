#!/usr/bin/env node
/**
 * Capability-version-bump gate — G01 exit criterion, second sentence:
 * "A capability cannot be added without a version bump."
 *
 * A committed snapshot (capability-manifest.json) records the scope list
 * (SCOPES, src/capabilities.ts) and the ExtensionApi member list
 * (src/index.ts) as of the LAST version bump. This gate recomputes the
 * current capability surface from source and compares it to the snapshot:
 *
 *   - surface unchanged                       -> pass, any version is fine
 *   - surface changed, package.json version >
 *     the snapshot's recorded version         -> pass (the bump happened)
 *   - surface changed, version NOT bumped      -> FAIL
 *
 * Usage:
 *   node scripts/check-capability-version-bump.mjs           # check
 *   node scripts/check-capability-version-bump.mjs --write   # update the
 *                                                              snapshot to
 *                                                              the current
 *                                                              surface and
 *                                                              version
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MANIFEST_PATH = path.join(ROOT, "capability-manifest.json");
const CAPABILITIES_SRC = path.join(ROOT, "src", "capabilities.ts");
const INDEX_SRC = path.join(ROOT, "src", "index.ts");
const PACKAGE_JSON = path.join(ROOT, "package.json");

function currentScopes() {
  const src = readFileSync(CAPABILITIES_SRC, "utf8");
  const match = src.match(/export const SCOPES = \[([\s\S]*?)\] as const;/);
  if (!match) {
    console.error("Capability version-bump gate CANNOT RUN: could not find SCOPES array in src/capabilities.ts.");
    process.exit(1);
  }
  return [...match[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]).sort();
}

function currentApiSurface() {
  const src = readFileSync(INDEX_SRC, "utf8");
  const match = src.match(/export interface ExtensionApi \{([\s\S]*?)\n\}/);
  if (!match) {
    console.error("Capability version-bump gate CANNOT RUN: could not find ExtensionApi interface in src/index.ts.");
    process.exit(1);
  }
  const body = match[1];
  // An index signature (`[name: string]: T`) makes every unlisted string key
  // reachable at the type level — the exact "anything not granted is
  // unreachable" violation this gate exists to catch changes to, not just
  // named-member additions/removals.
  const hasOpenIndexSignature = /\[\s*\w+\s*:\s*string\s*\]\s*:/.test(body);
  const members = [];
  for (const line of body.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("/*") || trimmed.startsWith("*") || trimmed.startsWith("//")) continue;
    const m = trimmed.match(/^(\w+)\??:/);
    if (m) members.push(m[1]);
  }
  return { members: members.sort(), hasOpenIndexSignature };
}

const scopes = currentScopes();
const { members: apiMembers, hasOpenIndexSignature } = currentApiSurface();
const pkg = JSON.parse(readFileSync(PACKAGE_JSON, "utf8"));
const currentVersion = pkg.version;

if (!existsSync(MANIFEST_PATH)) {
  console.error(
    `Capability version-bump gate FAILED: no capability-manifest.json snapshot exists.\n` +
      "Create it with: node scripts/check-capability-version-bump.mjs --write",
  );
  process.exit(1);
}

const snapshot = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
const surfaceChanged =
  JSON.stringify(scopes) !== JSON.stringify(snapshot.scopes) ||
  JSON.stringify(apiMembers) !== JSON.stringify(snapshot.apiMembers) ||
  hasOpenIndexSignature !== snapshot.hasOpenIndexSignature;

if (process.argv.includes("--write")) {
  writeFileSync(
    MANIFEST_PATH,
    JSON.stringify({ version: currentVersion, scopes, apiMembers, hasOpenIndexSignature }, null, 2) + "\n",
  );
  console.log(`capability-manifest.json written: version ${currentVersion}, ${scopes.length} scope(s), ${apiMembers.length} api member(s), openIndexSignature=${hasOpenIndexSignature}.`);
  process.exit(0);
}

if (!surfaceChanged) {
  console.log(`Capability version-bump gate: capability surface unchanged (${scopes.length} scope(s), ${apiMembers.length} api member(s)).`);
  process.exit(0);
}

if (currentVersion === snapshot.version) {
  console.error(
    `Capability version-bump gate FAILED: the capability surface changed but package.json's version ` +
      `(${currentVersion}) matches the last recorded snapshot (${snapshot.version}) — no bump happened.\n\n` +
      `Snapshot scopes:     ${JSON.stringify(snapshot.scopes)}\n` +
      `Current scopes:      ${JSON.stringify(scopes)}\n` +
      `Snapshot apiMembers: ${JSON.stringify(snapshot.apiMembers)}\n` +
      `Current apiMembers:  ${JSON.stringify(apiMembers)}\n` +
      `Snapshot openIndexSignature: ${snapshot.hasOpenIndexSignature}\n` +
      `Current openIndexSignature:  ${hasOpenIndexSignature}\n\n` +
      `Bump package.json's version, then run: node scripts/check-capability-version-bump.mjs --write`,
  );
  process.exit(1);
}

console.log(
  `Capability version-bump gate: capability surface changed AND version was bumped ` +
    `(${snapshot.version} -> ${currentVersion}). Run --write to snapshot the new surface.`,
);
