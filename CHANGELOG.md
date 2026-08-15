# Changelog

<!-- Release headings must use ISO dates (## x.y.z - YYYY-MM-DD); test/meta.test.ts enforces this on the head entry. -->

## 1.2.14 - 2026-08-15

### Fixed

- Removed the two repository-owned manual npm OIDC token-exchange probes after
  the immutable `v01.02.13` canary proved that the no-environment identity was
  rejected as expected while the exact `npm-production` identity still
  received `401`, even with npm's operation header. Trusted Publishing
  credential acquisition now belongs exclusively to the official,
  SHA-512-verified npm 12.0.2 client in the real `npm publish` step inside
  `npm-production`.
- Serialized GitHub Packages behind successful, unprivileged npmjs visibility
  and integrity verification. An npm authorization failure therefore stops
  before either the GitHub Packages writer or GitHub Release reconciliation.
- Preserved `v01.02.12` and `v01.02.13` as protected tag-only failed canaries;
  neither produced npmjs, GitHub Packages, or GitHub Release artifacts. The new
  immutable recovery target is `v01.02.14` / npm `1.2.14`.

## 1.2.13 - 2026-08-15

### Fixed

- Added npm CLI's `npm-command: publish` operation header to both manual
  Trusted Publisher exchange probes. The immutable canary disproved that
  hypothesis: the exact `npm-production` probe still returned `401`, and all
  project-code and publication jobs remained skipped.
- Superseded this tag-only canary with the official-client recovery in
  `v01.02.14`; no npmjs, GitHub Packages, or GitHub Release artifact exists for
  `v01.02.13`.

## 1.2.12 - 2026-08-15

### Added

- Added the repository Project, Incident/Maintenance/Spike issue templates,
  Discussion shortcuts and the G1..G4 tracking ritual in `AGENTS.md` and
  `CLAUDE.md`.

### Changed

- Updated `@types/node` to 26.2.0 and `esbuild` to 0.28.2, including the exact
  reviewed install-script authorization for the new esbuild version.
- Replaced the internal Zizmor reusable workflow with the official
  `zizmorcore/zizmor-action`, fixed to its reviewed Action and CLI releases.
- Aligned CodeQL, Dependency Review, OpenSSF Scorecard, Pages, CI and public
  formatting with their official implementations and least-privilege token
  grants. Project membership now comes from each Project's native Auto-add
  workflow.
- Raised the default Dependabot cooldown to seven days so the official Zizmor
  audit accepts both update definitions; GitHub Actions remain explicitly
  excluded from cooldown and security updates remain immediate.
- Isolated concurrency for every auto-tag push gate (CI, CodeQL, Scorecard,
  Zizmor and Public Format) by immutable SHA while retaining cancellation only
  for superseded pull-request runs, so every versioned `main` commit remains
  observable to release reconciliation.

### Removed

- Removed Native Auto-merge, the repository-owned add-to-project workflow, the
  custom CodeQL and Scorecard SARIF gates and their semantic regression
  harnesses. The native merge queue, native Project Auto-add and GitHub
  code-scanning protections are the authoritative controls.

### Security

- Prepared the supported security release target for `v01.02.12` / npm
  `1.2.12`.
- Bound every privileged release checkout to the immutable SHA carried by the
  protected-tag event while retaining the independent tag, checkout and gate
  identity checks before each publication write.
- Documented the operator-approved, file-local Zizmor exception for the
  release controller's `workflow_run`; the controller accepts only the exact
  successful CI `push` on `main` and revalidates its SHA before write
  operations. The exception does not disable the audit anywhere else.
- Removed the retired historical-release helper and its circular contract tests
  after confirming that no live workflow or production code consumed them. The
  exact pre-removal source remains preserved at its signed commit and SHA-256;
  retained workflow and attestation fixtures are hash-pinned by a small test
  that also proves the executable entry points remain absent. No CodeQL
  exclusion, suppression, or alert dismissal is used.

## 1.2.11 - 2026-08-05

**Patch — adds the `ultrabrain_server_info` tool.** A read-only, idempotent runtime introspection tool mirroring the cross-review `server_info` shape, adapted to Ultrabrain's specifics: server identity (name, publisher, version, release date, homepage, sponsors URL, license), transport and execution flags, capability flags, the full tool/prompt/resource/resource-template surface, built-in template ids, the resolved persistence `data_dir` with the consumed env var (`config_load` + `config_precedence`), active session count, engine limits (session/branch/id/text caps) and reserved branch keys, Node runtime info, and the local-first security policy.

### Added

- `ultrabrain_server_info` tool returning the payload above as `structuredContent` plus text, honoring `response_format`.
- `src/meta.ts` server-identity constants with a vitest lockstep guard against `package.json` and the CHANGELOG head (version-drift class permanently fenced).
- `UltraBrainEngine.runtimeInfo()` exposing persistence state, active session count, limits, and reserved branch keys.
- Smoke assertions: tool listed with read-only/idempotent annotations, version parity with `package.json`, `tools` self-consistency against `tools/list`, `data_dir`/`config_load` reflecting the configured state dir, `structuredContent` present.

## 1.2.10 - 05/08/2026

**Patch — aligns release administration and dependency automation.** The
pre-publication gate now resolves `LCV_AUTOMATION_TOKEN` from the
`github-administration` environment without creating a GitHub Deployment,
while registry writers remain isolated in their existing production
environments. npm commands rely on the repository's verified canonical
`https://registry.npmjs.org/` configuration instead of repeating per-command
registry flags, and the clean-consumer regression rejects inherited registry
configuration before installing from its own minimal `.npmrc`.

GitHub Actions now resolve the latest patch of each configured Node.js major,
CodeQL and the shared organization workflows use their reviewed immutable
pins, and Dependabot keeps the three-day cooldown for package ecosystems while
allowing GitHub Actions updates immediately. CodeQL version and security
updates remain independently grouped so an urgent security update cannot wait
behind a routine version batch. No tool, schema, configuration or
persisted-state contract changes.

**Validation.** A clean strict-script `npm ci`, the full `npm test` chain (8
test files / 73 unit tests plus smoke and clean-consumer coverage), typecheck,
Biome, public formatting and dry-run packaging passed. The registry audit found
zero vulnerabilities; all 146 installed packages with registry signatures and
all 36 available attestations verified. Zizmor reported no findings.

## 1.2.9 - 03/08/2026

**Security patch — isolates npm publication authority and updates the verified
toolchain.** CI, public formatting and publication now bootstrap npm 12.0.2
from its exact SHA-512-verified registry archive on Linux and Windows. Two
clean-room OIDC jobs run before any checkout or dependency execution and fail
closed unless npm returns its documented `401` rejection or identity-concealing
`404` outside `npm-production`, then authorizes the exact context inside it with
`201`. Both probes use npm-compatible scoped-package escaping. The positive probe discards its issued
credential without checking out code or invoking an action; only the immutable
npmjs writer uses an npm OIDC credential to publish. Public registry and
provenance verification run afterward without `npm-production`, and the GitHub Release
waits for their success. Install gates use npm 12's strict reviewed-script policy.
The lockfile also moves to Hono 4.12.34, fixed `fast-uri` 3.1.5, PostCSS 8.5.25
and a scoped `express-rate-limit → ip-address` 10.4.0 override for
GHSA-8j4g-w8fx-2239,
GHSA-mwp4-54f8-5fhr, GHSA-4xrf-jv44-h6hh and GHSA-22jq-vg5j-6vgg. No tool,
schema, configuration or persisted-state contract changes.

**Validation.** Full `npm test` (73 unit tests plus smoke and clean-consumer
coverage), typecheck, Biome and public-format checks passed. The publication
regression proves the documented negative statuses, npm-compatible package
escaping, and the exact positive npm OIDC environment boundary;
Zizmor, Actionlint, ShellCheck and the clean Windows npm bootstrap also passed.

## 1.2.8 - 28/07/2026

**Patch — completed historical recovery and CI dependency hygiene.** The
provenance-bound recovery successfully published the exact 1.2.5 and 1.2.6
GitHub Release drafts as immutable releases with their verified package
assets. Both ambiguous 1.2.4 drafts remain intentionally untouched as audit
evidence. With every safe target completed, the one-time mutating recovery
workflow is retired from the active Actions surface. Its unshipped helper is
excluded explicitly from CodeQL extraction and remains executable only by its
contract tests; the exact workflow fixture, runbook, and attestation fixture
remain as historical audit evidence.

The development bundle now incorporates `@modelcontextprotocol/sdk` 1.30.0.
Its clean-consumer regression reads the installed SDK identity dynamically and
requires that exact name and version in the bundled third-party license
inventory, preventing future dependency bumps from repeating the former
hard-coded-version failure. All active Socket Security and StepSecurity
repository integrations are removed. Dependabot automation uses the current
settling controller, and Zizmor runs through the checksum-verified central
workflow. If the first commit of a new version fails a security gate before any
tag exists, Auto-tag now promotes a later successful CI commit in the same
version epoch instead of retrying the permanently failed SHA. No runtime tool
API or persisted-state format changes.

## 1.2.7 - 22/07/2026

**Patch — eventual-consistency-safe draft discovery.** After creating a
recoverable GitHub Release draft, reconciliation now waits for the paginated
Releases API to expose that exact server-issued release id. The retry is
bounded, rejects ambiguous or different release identities, and fails closed
before any asset upload if visibility does not converge. No runtime API or
state format changes.

## 1.2.6 - 22/07/2026

**Patch — boolean-safe immutable release reconciliation.** Release metadata
validation now converts required JSON booleans to strings before applying
`jq -e`, so valid `false` values for `draft` and `prerelease` cannot terminate
the fail-closed shell step before asset upload. A regression test covers every
initial, pre-publication, and final read. No runtime API or state format
changes.

## 1.2.5 - 22/07/2026

**Patch — immutable draft-release recovery.** GitHub Release reconciliation now
discovers both draft and published releases through the paginated Releases API,
binds every mutation and asset transfer to the exact release id, and verifies
the downloaded asset bytes before publishing the draft. Required validation
workflows retain queued runs instead of canceling or re-running historical
commits into a newer concurrency group. This supersedes the incomplete 1.2.4
GitHub Release while preserving its immutable tag, npm provenance, and package
artifact. No runtime API or state format changes.

## 1.2.4 - 22/07/2026

**Patch — provenance-safe release recovery.** Fixes the npm tarball path that
caused the 1.2.3 publisher to interpret `artifacts/...tgz` as a Git SSH package
specification. Auto-tagging now serializes every candidate without canceling
queued bumps, recovers the immutable first-parent version-introduction commit,
uses authenticated GitHub API ref resolution, and requires all always-on gates
plus zero-result CodeQL SARIF at that exact SHA before creating or redispatching
the canonical tag. The unpublished `v01.02.03` tag remains immutable audit
evidence; 1.2.4 supersedes it so npm provenance, source commit, and workflow
instructions all identify the same corrected release commit. No runtime API or
state format changes.

## 1.2.3 - 22/07/2026

**Security and release hardening.** The npm package now contains a self-contained
MCP stdio bundle plus its third-party license inventory and is verified from a
clean consumer install. Dependabot approval, guarded branch refresh, and
exact-SHA squash merge are delegated to the reviewed central controller. Every
workflow and job retains the organization-required `write-all` policy while
using immutable action SHAs, non-persistent checkout credentials, protected
release environments, and Zizmor 1.28.0 analysis. Release jobs bind npm and
GitHub Packages integrity to the same immutable tarball and prevent an older or
prerelease build from replacing the latest stable release.

## 1.2.2 - 21/07/2026

**Security patch — update the transitive HTTP request parser.** Resolves GHSA-v422-hmwv-36x6 / CVE-2026-12590 by updating `body-parser` from 2.2.2 to 2.3.0 through the existing `@modelcontextprotocol/sdk` → Express dependency chain. The patched parser rejects invalid or `NaN` request-size limits instead of silently disabling body-size enforcement.

## 1.2.1 - 17/07/2026

**Patch — retro cross-review follow-up.** A peer review of the 1.2.0 diff flagged one latent inconsistency: `engine.export()` with a `limit` and `json` format returned the limited `thoughts` but the full `session.branches`, so a branch record outside the window could leak back in. The path is not reachable through the `ultrabrain_export` tool (it passes no limit) or the markdown export, but the JSON export is now consistent: branches are filtered to the retained thought ids without mutating the session, covered by a regression test.

## 1.2.0 - 17/07/2026

**Minor — audit remediation: correctness cluster, a unit-test layer, and Tier-1 reasoning-gate features.** Outcome of a multi-agent audit and cross-review. Adds a `vitest` unit suite alongside the existing smoke integration test, fixes the confirmed correctness findings (each covered by a red-then-green test), and lands additive Tier-1 features. No public tool was removed or renamed.

### Added

- `vitest` dev dependency + `test/` unit suite; `npm test` now runs build + unit + smoke, and a `prepare` script builds `dist/` on git-URL installs.
- `ultrabrain_review` gains a `mermaid` format that renders the thought/branch graph.
- `ultrabrain_validate` reports template stage coverage (covered vs uncovered) and flags uncovered stages under strict mode.
- `ultrabrain_think` surfaces `related_thoughts` (ranked by step_type match and tag overlap) and front-loads a concise reasoning protocol in its tool description.
- JSON-shaped tool results now carry `structuredContent` alongside the text block.
- CI runs on Windows + Linux across Node 22 and 24; the publish workflow asserts the tag matches the package version; the smoke test asserts server/package version parity and that unknown tools reject.

### Fixed

- Persistence: branch/thought record identity is re-linked on load (updates no longer diverge across a restart); session writes are atomic (temp + rename); unparseable or filename/id-mismatched files are quarantined instead of silently discarded or resurrected; malformed thought records are rejected on load.
- State/validation: `ultrabrain_update` without a branch id targets the main chain; reserved object keys are rejected as branch ids; `ultrabrain_update` enforces the text cap and metric range; enum values are accepted case-insensitively; `ultrabrain_start` validates the seeded chain; session status reverts to active; merge numbering uses the max thought number; trimming never discards the newest record; `ultrabrain_reset all_sessions` only deletes engine-created files and single reset is transactional; session ids are length-bounded; unknown tools surface as JSON-RPC protocol errors.
- Robustness/rendering: SIGINT/SIGTERM graceful shutdown; `ultrabrain_update` annotated `destructiveHint:true`; the progress checkpoint no longer fires on the first thought; `rewriteThought` preserves newlines; `ultrabrain_review` markdown honors `limit`.

## 1.1.1 - 15/05/2026

**Patch — 4-gate quality directive compliance.** Adds `@biomejs/biome` ^2.4.15 + `biome.json` aligned with prettier conventions (lineWidth 100, indent space 2, double quotes, trailing commas all, semicolons always). New `npm run biome` + `npm run biome:write` scripts scoped to `src/` and `scripts/`. CI workflow runs `npm run biome` between `npm ci` and `npm test`.

### Added

- `@biomejs/biome` (^2.4.15) devDep + `biome.json` config.
- `npm run biome` (check-only) + `npm run biome:write` (auto-fix) scripts.
- CI workflow runs biome between install and smoke.

### Changed

- `src/engine.ts` + `src/normalize.ts` + minor source files: cosmetic formatting + unused-import cleanup from `biome --write` and `biome --write --unsafe` (no semantic changes).
- `SERVER_VERSION` in `src/index.ts` synced to `1.1.1`.

## 1.1.0 - 12/05/2026

- Enforced `depth_level` and `max_depth` as positive integers, and rejected reasoning steps where depth exceeds the declared maximum.
- Added active reference validation for `revises_thought`, `branch_from_thought`, and `parent_thought` so new steps cannot point to shifted or missing thoughts.
- Updated `ultrabrain_update` to return the full updated record, including refreshed quality, warnings, labels, suggestions, and `updated_at`.
- Added real markdown rendering for `ultrabrain_merge` when `response_format` is `markdown`.
- Added optional file-backed session persistence through `ULTRABRAIN_STATE_DIR` or `ULTRABRAIN_PERSIST_DIR`; default behavior remains process-local.
- Expanded the MCP smoke test to cover persistence reloads, update payloads, depth validation, missing-reference errors, and markdown merge output.
- Re-audited workflows against the LCV workspace baseline and StepSecurity Harden-Runner standard.

## 1.0.0 - 12/05/2026

- First publication target for `@lcv-ideas-software/ultrabrain-mcp` as public release `v01.00.00`.
- Added LCV-branded MCP tool surface with `ultrabrain_*` tool names only.
- Added session lifecycle, thought append, thought update, branching, branch merge, validation, analysis, review, status, history, export, metrics, and templates.
- Added MCP prompts and resources for problem breakdown, critical review, synthesis, sessions, and templates.
- Added clean en-US runtime messages, schema descriptions, warnings, suggestions, and bias checks.
- Added research matrix documenting inspected reasoning-tool variants and the Ultrabrain implementation decisions.
- Added LCV repository baseline: CI, Dependabot, Pages, publish workflow, release automation, StepSecurity Harden-Runner, README, site, changelog, notices, and sponsor links.
- Verified that development checkout and global package installation are separate concerns; global installation must be a real package install, not a workspace junction.
