# Changelog

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
