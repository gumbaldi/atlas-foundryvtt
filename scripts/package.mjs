#!/usr/bin/env node
/**
 * Builds and packages the addon into a Foundry-installable Zip + a standalone
 * module.json (the manifest). Foundry's "Install Module" flow always fetches
 * the manifest URL first, reads its `download` field, then fetches *that* —
 * so the two files are kept side by side in release/, exactly as a real
 * install would consume them (see docs/RELEASING.md).
 *
 * The public release channel (GitHub Releases vs. manual Zip distribution)
 * is an open owner decision (P9 plan) — this script never hardcodes a
 * manifest/download URL. Pass them via env vars; if unset, module.json keeps
 * whatever it already has (a manual/private distribution is still valid —
 * see docs/RELEASING.md's "Zip distribution per Hand" variant).
 */
import { execFileSync, execSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const DIST = join(ROOT, 'dist');
const RELEASE_DIR = join(ROOT, 'release');
// Fixed, not "now" — every build of the same version produces a byte-identical
// zip (plan: "package.mjs deterministic … so that artefacts can be diffed").
const FIXED_MTIME = new Date('2020-01-01T00:00:00Z');

function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}

function collectFilesSorted(dir, base = '') {
  const entries = readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
  const files = [];
  for (const entry of entries) {
    const rel = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) files.push(...collectFilesSorted(join(dir, entry.name), rel));
    else files.push(rel);
  }
  return files;
}

console.log('› Building addon (npm run build)…');
execSync('npm run build', { cwd: ROOT, stdio: 'inherit' });

const moduleJsonPath = join(DIST, 'module.json');
if (!existsSync(moduleJsonPath)) fail('dist/module.json not found after build — did the build succeed?');

const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
const version = process.env.ATLAS_FOUNDRY_VERSION || pkg.version;
if (!version) fail('package.json has no "version" field');

const manifestUrl = process.env.ATLAS_FOUNDRY_MANIFEST_URL;
// "{version}" is substituted — e.g. https://github.com/<owner>/<repo>/releases/download/foundry-v{version}/atlas-foundry-v{version}.zip
const downloadUrlTemplate = process.env.ATLAS_FOUNDRY_DOWNLOAD_URL_TEMPLATE;

const moduleJson = JSON.parse(readFileSync(moduleJsonPath, 'utf8'));
moduleJson.version = version;
if (manifestUrl) moduleJson.manifest = manifestUrl;
if (downloadUrlTemplate) moduleJson.download = downloadUrlTemplate.replaceAll('{version}', version);
if (!manifestUrl || !downloadUrlTemplate) {
  console.warn(
    '⚠ ATLAS_FOUNDRY_MANIFEST_URL / ATLAS_FOUNDRY_DOWNLOAD_URL_TEMPLATE not set — module.json keeps its existing manifest/download values. See docs/RELEASING.md for the two supported release channels.',
  );
}
writeFileSync(moduleJsonPath, `${JSON.stringify(moduleJson, null, 2)}\n`);
console.log(`✓ Patched dist/module.json to version ${version}`);

mkdirSync(RELEASE_DIR, { recursive: true });
const zipName = `atlas-foundry-v${version}.zip`;
const zipPath = join(RELEASE_DIR, zipName);
rmSync(zipPath, { force: true });

const files = collectFilesSorted(DIST);
for (const rel of files) utimesSync(join(DIST, rel), FIXED_MTIME, FIXED_MTIME);

try {
  execFileSync('zip', ['-X', '-q', zipPath, ...files], { cwd: DIST });
} catch (err) {
  fail(`"zip" command failed — is it installed? (${err instanceof Error ? err.message : String(err)})`);
}
console.log(`✓ Wrote ${zipPath} (${files.length} files, module.json at the zip root)`);

// The manifest itself — a plain module.json, not inside the zip (Foundry
// installation convention: manifest URL -> this file -> its "download" field -> the zip).
writeFileSync(join(RELEASE_DIR, 'module.json'), readFileSync(moduleJsonPath));
console.log(`✓ Wrote ${join(RELEASE_DIR, 'module.json')}`);

console.log(`\nRelease artifacts in ${RELEASE_DIR}/:\n  - ${zipName}\n  - module.json`);
