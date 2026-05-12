# Contributing

`ultrabrain-mcp` follows the LCV Ideas & Software repository baseline used by the
`cross-review-*` projects.

## Branches

- `main` is the only permanent branch.
- CI and release automation run from `main`.
- Public tags use the padded display format `v00.00.00`.
- `package.json` keeps normal npm SemVer.

## Local Gates

Run before opening a pull request:

```bash
npm ci
npm test
npm pack --dry-run
```

## Release Automation

Do not publish manually from a developer workstation.

1. Update `package.json` and `CHANGELOG.md`.
2. Merge to `main`.
3. `auto-tag.yml` creates the padded version tag.
4. `publish.yml` publishes to npmjs.com with npm Trusted Publishing and mirrors
   to GitHub Packages.
5. `pages.yml` deploys `site/`.

## Current Source Layout

This repository is currently `dist`-first because it was bootstrapped from an
installed npm runtime package. Until a later source recovery/refactor release,
runtime edits are made in `dist/` and must be covered by smoke tests.

## Security

Never commit API keys, `.env`, bearer tokens, local MCP credentials,
or `node_modules/`.
