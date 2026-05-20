# ultrabrain-mcp

<p align="center">
  <img src="./.github/assets/lcv-ideas-software-logo.svg" alt="LCV Ideas & Software" width="88" />
</p>

<p align="center">
  <strong>LCV's local MCP reasoning gate for structured engineering thought.</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@lcv-ideas-software/ultrabrain-mcp"><img alt="npm" src="https://img.shields.io/npm/v/@lcv-ideas-software/ultrabrain-mcp.svg" /></a>
  <a href="https://github.com/LCV-Ideas-Software/ultrabrain-mcp/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/LCV-Ideas-Software/ultrabrain-mcp/actions/workflows/ci.yml/badge.svg" /></a>
  <a href="https://ultrabrain-mcp.lcv.dev"><img alt="site" src="https://img.shields.io/badge/site-ultrabrain--mcp.lcv.dev-0f766e.svg" /></a>
  <a href="./LICENSE"><img alt="License" src="https://img.shields.io/badge/license-Apache--2.0-green.svg" /></a>
</p>

**Install.** `npm install -g @lcv-ideas-software/ultrabrain-mcp` from npmjs.com, or `npm install -g @lcv-ideas-software/ultrabrain-mcp --registry=https://npm.pkg.github.com` from the GitHub Packages mirror.

**Status.** Latest release target: **v01.01.00** for npm package `1.1.0`. First publication started at **v01.00.00**. Public GitHub tags use the LCV display convention `v00.00.00`; npm keeps normal SemVer.

## Change History

The version history at a glance:

| Release     | Package | Date       | Notes                                                                                                                                                                                   |
| ----------- | ------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `v01.01.00` | `1.1.0` | 2026-05-12 | Refinements for depth enforcement, active thought-reference validation, update record returns, real markdown merge output, optional file persistence, and expanded smoke coverage.      |
| `v01.00.00` | `1.0.0` | 2026-05-12 | First LCV Ultrabrain MCP release: branded tool surface, session lifecycle, branching, merging, validation, analysis, prompts, resources, Pages, CI, publish, and StepSecurity baseline. |

## What It Does

`ultrabrain-mcp` is an LCV-created MCP server for local, structured reasoning before engineering work is closed. It gives agents a single branded gate for:

- step-by-step reasoning with branches and revisions;
- quality metrics, confidence, budget mode, and meta checkpoints;
- bias detection and counterexample prompts;
- explicit evidence, assumptions, alternatives, risks, and next actions;
- session review, validation, metrics, export, prompts, and resources.

The server does not call external LLM APIs. It is a local MCP reasoning scratchpad and quality gate, so source code and private task context stay inside the active MCP host.

## Tools

| Tool                   | Purpose                                                                      |
| ---------------------- | ---------------------------------------------------------------------------- |
| `ultrabrain_start`     | Create a reasoning session and optionally seed the first thought.            |
| `ultrabrain_think`     | Append the canonical Ultrabrain reasoning step.                              |
| `ultrabrain_update`    | Strengthen an existing thought with evidence, risks, confidence, or metrics. |
| `ultrabrain_branch`    | Create or continue an alternative reasoning path.                            |
| `ultrabrain_merge`     | Merge branch insights into a synthesis, best-evidence path, or decision.     |
| `ultrabrain_validate`  | Check evidence, alternatives, verification, bias, and closure gaps.          |
| `ultrabrain_analyze`   | Summarize quality, confidence, labels, bias counts, and recommendations.     |
| `ultrabrain_review`    | Render a session as summary, linear chain, tree, markdown, or JSON.          |
| `ultrabrain_status`    | Show session state, thought count, branches, and latest quality score.       |
| `ultrabrain_history`   | Return recent thought records.                                               |
| `ultrabrain_export`    | Export a session as markdown, text, or JSON.                                 |
| `ultrabrain_metrics`   | Return aggregate session and reasoning metrics.                              |
| `ultrabrain_templates` | List built-in LCV engineering reasoning templates.                           |
| `ultrabrain_reset`     | Clear one session or all in-memory sessions.                                 |

## Canonical Example

```json
{
  "thought": "Map the failure, list evidence, compare alternatives, and choose the next verification step.",
  "thought_number": 1,
  "total_thoughts": 4,
  "next_thought_needed": true,
  "mode": "hybrid",
  "step_type": "analysis",
  "evidence": ["The failing behavior was reproduced locally."],
  "alternatives": ["patch the caller", "patch the shared parser"],
  "risks": ["a shared parser change can affect unrelated hosts"],
  "next_actions": ["run the focused test", "inspect the shared call path"],
  "quality_metrics": {
    "logical_consistency": 4,
    "completeness": 4,
    "objectivity": 4,
    "practicality": 5,
    "clarity": 5
  },
  "response_format": "json"
}
```

## MCP Configuration

Global npm installation target in the LCV Windows environment:

```text
C:\npm-global\node_modules\@lcv-ideas-software\ultrabrain-mcp
```

Use the MCP server name `ultrabrain` in host configs:

```json
{
  "mcpServers": {
    "ultrabrain": {
      "command": "ultrabrain-mcp",
      "args": []
    }
  }
}
```

Development checkout and global installation are intentionally separate. Do not create a junction or symlink from `C:\npm-global\node_modules\@lcv-ideas-software\ultrabrain-mcp` to the workspace checkout.

Optional local persistence can be enabled per host with `ULTRABRAIN_STATE_DIR` or `ULTRABRAIN_PERSIST_DIR`. When unset, sessions remain process-local.

## Development

```sh
npm install
npm test
npm run format:public:check
npm pack --dry-run
```

The smoke test starts the built MCP server over stdio, lists tools, verifies the branded `ultrabrain_*` surface, exercises session start, thought, branch, merge, validation, status, export, prompts, and resources.

## Release Automation

This repository follows the LCV package baseline:

- CI runs on `main` pull requests and pushes.
- Dependabot tracks npm and GitHub Actions updates.
- Pages deploys the static site from `site/` using `ultrabrain-mcp.lcv.dev`.
- Auto-tagging derives padded public tags from `package.json` version.
- Publish workflow releases to npmjs.com, GitHub Packages, and GitHub Releases.
- StepSecurity Harden-Runner is enabled on workflows.

## Research

See [docs/research-matrix.md](./docs/research-matrix.md). Ultrabrain imports ideas only at the architecture level. It does not copy third-party code, text, branding, non-English localization strings, or external model/API behavior.

## Links

- Site: [https://ultrabrain-mcp.lcv.dev](https://ultrabrain-mcp.lcv.dev)
- npmjs.com: [https://www.npmjs.com/package/@lcv-ideas-software/ultrabrain-mcp](https://www.npmjs.com/package/@lcv-ideas-software/ultrabrain-mcp)
- GitHub: [https://github.com/LCV-Ideas-Software/ultrabrain-mcp](https://github.com/LCV-Ideas-Software/ultrabrain-mcp)
- Sponsors: [https://github.com/sponsors/LCV-Ideas-Software](https://github.com/sponsors/LCV-Ideas-Software)

## License

Apache-2.0. See [LICENSE](./LICENSE), [NOTICE](./NOTICE), and [THIRDPARTY](./THIRDPARTY.md).

---

<p align="center"><span style="font-size: 1.5em;"><strong>© LCV Ideas &amp; Software</strong></span><br><sub>LEONARDO CARDOZO VARGAS TECNOLOGIA DA INFORMACAO LTDA<br>Rua Pais Leme, 215 Conj 1713 - Pinheiros<br>São Paulo - SP<br>CEP 05.424-150<br>CNPJ: 66.584.678/0001-77<br>IM 05.424-150</sub></p>
