# Releasing the Atlas Foundry Integration

No CI currently runs this checklist automatically (no `.github/workflows/` exists in this
repository) — treat every step below as a manual gate before publishing a version. If CI
is added later, wire it to run the same commands from `integrations/foundryvtt/`.

## 1. Verify

Run from `integrations/foundryvtt/`:

```bash
npm run lint
npm run typecheck
npm run test               # Vitest unit suite
npm run build               # Vite production build
```

If a local Atlas backend is reachable (`./services.sh` from the repo root, or otherwise on
`:53001`):

```bash
# From the repo root — Foundry category + the rest of the standard API suite
bash scripts/test-api.sh http://localhost:53001/api/v1 <email> <password>

# From integrations/foundryvtt/ — contract tests against the live backend, and re-records
# fixtures for CI/offline runs. Refuses to run unless ATLAS_TEST_URL is localhost.
ATLAS_TEST_URL=http://localhost:53001/api/v1 \
ATLAS_TEST_EMAIL=<email> ATLAS_TEST_PASSWORD=<password> \
npm run test:contract:record
```

Without a reachable backend, `npm run test:contract` still runs against the fixtures
already committed under `contract/fixtures/` — useful as an offline smoke check, but it
only catches drift since the last `--record` run, not new backend changes.

All of the above must be green before continuing.

## 2. Decide the version

SemVer, independent of the Atlas monorepo's own version. Bump `integrations/foundryvtt/package.json`'s
`version` — `module.json`'s `version` is patched automatically by the packaging step, don't
edit it by hand.

Add an entry to `CHANGELOG.md` (Keep a Changelog format) under a new version heading, moving
anything from `## [Unreleased]` into it.

## 3. Package

```bash
npm run package
```

Produces, deterministically (byte-identical for the same version + inputs):

- `release/atlas-foundry-v<version>.zip` — the installable module, `module.json` at the zip root.
- `release/module.json` — the manifest Foundry's "Install from Manifest URL" flow reads first.

By default the packaged `module.json` keeps whatever `manifest`/`download` URLs are already
in the source `module.json` (currently placeholders — see §4). To point at a specific
release:

```bash
ATLAS_FOUNDRY_MANIFEST_URL="https://github.com/<owner>/<repo>/releases/latest/download/module.json" \
ATLAS_FOUNDRY_DOWNLOAD_URL_TEMPLATE="https://github.com/<owner>/<repo>/releases/download/foundry-v{version}/atlas-foundry-v{version}.zip" \
npm run package
```

`{version}` in the download template is substituted with `package.json`'s version.

## 4. Publish — pick a release channel

This is an open owner decision (P9 plan) between two variants; the packaging script
supports both without code changes:

**A. GitHub Releases (requires a public — or public-enough — repo/mirror)**

1. Tag: `git tag foundry-v<version> && git push origin foundry-v<version>`.
2. Create a GitHub Release on that tag, uploading `release/atlas-foundry-v<version>.zip`
   and `release/module.json` as assets.
3. Use the `latest/download/module.json` URL pattern for `manifest` (§3's env vars) so
   Foundry's own update-check always finds the newest release; use the version-pinned
   `releases/download/foundry-v<version>/...` pattern for `download` (never `latest`
   there, or every installed copy would silently jump versions on interim releases).

**B. Manual Zip distribution (private repo, or no public release channel yet)**

1. Leave `ATLAS_FOUNDRY_MANIFEST_URL` / `ATLAS_FOUNDRY_DOWNLOAD_URL_TEMPLATE` unset —
   `module.json` keeps `manifest`/`download` empty or pointing at placeholders.
2. Distribute `release/atlas-foundry-v<version>.zip` directly (file share, internal wiki,
   etc.). Recipients use Foundry's "Install Module" → local file / "Manifest URL" only
   works if you host `module.json` + the zip somewhere reachable; otherwise they extract
   the zip straight into `{Foundry userData}/Data/modules/atlas-foundry`.
3. No auto-update path in this variant — document the version recipients are on.

## 5. Smoke-test and confirm compatibility

Before calling a release done:

1. Install the packaged Zip in a **fresh** Foundry v14 instance (not a dev symlink) —
   either via the manifest URL (channel A) or manual extraction (channel B).
2. Run through [docs/SMOKE-TEST.md](docs/SMOKE-TEST.md) completely, with a GM and a
   player browser.
3. Only after a full, successful pass: bump `compatibility.verified` in the *source*
   `module.json` (`integrations/foundryvtt/module.json`, not the packaged copy) to the
   exact Foundry version tested, commit that alongside the changelog entry.
4. Record the smoke-test date and Foundry version in `CHANGELOG.md`'s entry for this
   release (`Smoke-tested: <date> on Foundry v<x.y.z>`).

Never raise `compatibility.verified` without an actual pass — that field is the whole
point of the version-pin gate; treat it as a claim other GMs will trust before installing.

## Requirements

- `zip` CLI available on the machine running `npm run package` (used via `child_process`,
  not a bundled JS zip library).
- Node/npm matching `integrations/foundryvtt/package.json`'s toolchain (Vite 8, Vitest 4).
