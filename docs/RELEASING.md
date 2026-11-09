# Releasing the Atlas Foundry Integration

CI (`.github/workflows/release.yml`) runs lint, typecheck, the unit tests, the contract typecheck
and the contract tests against the recorded fixtures, then packages the module. Everything that
needs a real Foundry world or a live backend stays a manual gate below.

## 1. Verify

Run from the repository root:

```bash
npm run lint
npm run typecheck
npm run test               # Vitest unit suite
npm run typecheck:contract
npm run test:contract       # recorded fixtures, no network
npm run build               # Vite production build
```

If an Atlas backend is reachable (start it from the Atlas repository; the dev backend listens on
`:53001`), run the contract tests live. The credentials come from the environment only:

```bash
# Contract tests against the live backend, and re-record fixtures for CI/offline runs.
# Refuses to record unless ATLAS_TEST_URL is localhost; recorded tokens are replaced by placeholders.
ATLAS_TEST_URL=http://localhost:53001/api/v1 \
ATLAS_TEST_EMAIL=<email> ATLAS_TEST_PASSWORD=<password> \
npm run test:contract:record
```

With `ATLAS_TEST_URL` set, a backend that cannot be reached fails every route — it never falls back
to the fixtures. Without `ATLAS_TEST_URL`, `npm run test:contract` validates the committed
`contract/fixtures/` only, which catches drift since the last `--record` run, not new backend
changes. The per-user permission checks against a live backend (`scripts/test-api.sh`) belong to
the Atlas repository.

All of the above must be green before continuing.

## 2. Decide the version

SemVer, independent of the Atlas version. Raise `package.json`'s `version` (`./update_module.sh`
patch-bumps it and commits) — `module.json`'s `version` is patched automatically by the packaging
step, don't edit it by hand.

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

CI publishes through variant A: a push to `main` creates the GitHub release `foundry-v<version>`
with the Zip and `module.json`; a push to `test` refreshes the rolling `foundry-test` prerelease
(version `<version>-test.<run>`). Pull requests must raise the version. The packaging script also
supports variant B without code changes:

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
   `module.json` (the source file at the repository root, not the packaged copy) to the
   exact Foundry version tested, commit that alongside the changelog entry.
4. Record the smoke-test date and Foundry version in `CHANGELOG.md`'s entry for this
   release (`Smoke-tested: <date> on Foundry v<x.y.z>`).

Never raise `compatibility.verified` without an actual pass — that field is the whole
point of the version-pin gate; treat it as a claim other GMs will trust before installing.

## Requirements

- `zip` CLI available on the machine running `npm run package` (used via `child_process`,
  not a bundled JS zip library).
- Node/npm matching `package.json`'s toolchain (Vite 8, Vitest 4).
