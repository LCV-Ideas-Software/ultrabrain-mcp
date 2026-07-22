# Changelog

## 1.2.4 - 2026-07-22

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

## 1.2.3 - 2026-07-22

**Security and release hardening.** The npm package now contains a self-contained
MCP stdio bundle plus its third-party license inventory and is verified from a
clean consumer install. Dependabot approval, guarded branch refresh, and
exact-SHA squash merge are delegated to the reviewed central controller. Every
workflow and job retains the organization-required `write-all` policy while
using immutable action SHAs, non-persistent checkout credentials, protected
release environments, and Zizmor 1.28.0 analysis. Release jobs bind npm and
GitHub Packages integrity to the same immutable tarball and prevent an older or
prerelease build from replacing the latest stable release.

## 1.2.2 - 2026-07-21

**Security patch — update the transitive HTTP request parser.** Resolves GHSA-v422-hmwv-36x6 / CVE-2026-12590 by updating `body-parser` from 2.2.2 to 2.3.0 through the existing `@modelcontextprotocol/sdk` → Express dependency chain. The patched parser rejects invalid or `NaN` request-size limits instead of silently disabling body-size enforcement.

## 1.2.1 - 2026-07-17

**Patch — retro cross-review follow-up.** A peer review of the 1.2.0 diff flagged one latent inconsistency: `engine.export()` with a `limit` and `json` format returned the limited `thoughts` but the full `session.branches`, so a branch record outside the window could leak back in. The path is not reachable through the `ultrabrain_export` tool (it passes no limit) or the markdown export, but the JSON export is now consistent: branches are filtered to the retained thought ids without mutating the session, covered by a regression test.

## 1.2.0 - 2026-07-17

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

## 1.1.1 - 2026-05-15

**Patch — 4-gate quality directive compliance.** Adds `@biomejs/biome` ^2.4.15 + `biome.json` aligned with prettier conventions (lineWidth 100, indent space 2, double quotes, trailing commas all, semicolons always). New `npm run biome` + `npm run biome:write` scripts scoped to `src/` and `scripts/`. CI workflow runs `npm run biome` between `npm ci` and `npm test`.

### Added

- `@biomejs/biome` (^2.4.15) devDep + `biome.json` config.
- `npm run biome` (check-only) + `npm run biome:write` (auto-fix) scripts.
- CI workflow runs biome between install and smoke.

### Changed

- `src/engine.ts` + `src/normalize.ts` + minor source files: cosmetic formatting + unused-import cleanup from `biome --write` and `biome --write --unsafe` (no semantic changes).
- `SERVER_VERSION` in `src/index.ts` synced to `1.1.1`.

## 1.1.0 - 2026-05-12

- Enforced `depth_level` and `max_depth` as positive integers, and rejected reasoning steps where depth exceeds the declared maximum.
- Added active reference validation for `revises_thought`, `branch_from_thought`, and `parent_thought` so new steps cannot point to shifted or missing thoughts.
- Updated `ultrabrain_update` to return the full updated record, including refreshed quality, warnings, labels, suggestions, and `updated_at`.
- Added real markdown rendering for `ultrabrain_merge` when `response_format` is `markdown`.
- Added optional file-backed session persistence through `ULTRABRAIN_STATE_DIR` or `ULTRABRAIN_PERSIST_DIR`; default behavior remains process-local.
- Expanded the MCP smoke test to cover persistence reloads, update payloads, depth validation, missing-reference errors, and markdown merge output.
- Re-audited workflows against the LCV workspace baseline and StepSecurity Harden-Runner standard.

## 1.0.0 - 2026-05-12

- First publication target for `@lcv-ideas-software/ultrabrain-mcp` as public release `v01.00.00`.
- Added LCV-branded MCP tool surface with `ultrabrain_*` tool names only.
- Added session lifecycle, thought append, thought update, branching, branch merge, validation, analysis, review, status, history, export, metrics, and templates.
- Added MCP prompts and resources for problem breakdown, critical review, synthesis, sessions, and templates.
- Added clean en-US runtime messages, schema descriptions, warnings, suggestions, and bias checks.
- Added research matrix documenting inspected reasoning-tool variants and the Ultrabrain implementation decisions.
- Added LCV repository baseline: CI, Dependabot, Pages, publish workflow, release automation, StepSecurity Harden-Runner, README, site, changelog, notices, and sponsor links.
- Verified that development checkout and global package installation are separate concerns; global installation must be a real package install, not a workspace junction.
