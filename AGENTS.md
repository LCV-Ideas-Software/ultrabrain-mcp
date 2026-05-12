# AGENTS.md - ultrabrain-mcp

Pointer for AI agents working in this repository.

## Project

- Repository: `https://github.com/LCV-Ideas-Software/ultrabrain-mcp`
- Package: `@lcv-ideas-software/ultrabrain-mcp`
- Site: `https://ultrabrain-mcp.lcv.dev`
- Branch: `main`
- License: Apache-2.0

## Runtime Shape

This repository is a TypeScript MCP stdio server. Source lives in `src/`, build
output lives in `dist/`, and the runtime entry point is `dist/index.js`.

The public MCP surface is LCV-branded. Tool names must use the `ultrabrain_*`
prefix. Do not add legacy third-party tool names as public aliases.

## Mandatory Gates

```bash
npm test
npm run format:public:check
npm pack --dry-run
```

For local MCP runtime checks after installation:

```bash
ultrabrain-mcp
```

Do not run the server directly in a blocking shell unless it is attached to an
MCP client or a smoke harness; stdio MCP servers wait for protocol input.

## Release and Publishing

- Do not publish from the workstation.
- `auto-tag.yml` creates the padded display tag (`v00.00.00`) from `package.json`.
- The first public release is `v01.00.00` from npm package version `1.0.0`.
- `publish.yml` publishes to npmjs.com and GitHub Packages, then creates the GitHub Release.
- GitHub Pages serves `site/` through the custom domain `ultrabrain-mcp.lcv.dev`.
- Workflows must remain integrated with StepSecurity Harden-Runner.

## Security

- Do not commit `node_modules/`, `dist/`, `.env`, API keys, MCP bearer tokens, or local host configs.
- This package is local-first and must not add external LLM/API calls without an explicit design decision.
- Keep development checkout and global installation separate. Do not use `npm link`
  or create a junction from `C:\npm-global\node_modules\@lcv-ideas-software\ultrabrain-mcp`
  to this workspace checkout.

## Workspace Policy

Follow the root `C:\Users\leona\lcv-workspace\AGENTS.md` directives. In
particular: no self-review in cross-review gates, `ultrabrain` plus
`cross-review-v2` before substantive closure, `cross-review-v1` only as fallback
for v2, `main` as the deployment branch, and Commit & Sync only after final
audit when requested.
