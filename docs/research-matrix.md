# Ultrabrain Research Matrix

This matrix records the reasoning-tool variants inspected before the first
LCV Ultrabrain MCP release.

Ultrabrain is an LCV-created MCP server. The implementation imports ideas only
at the architecture and product-design level. It does not copy third-party
source code, public tool names, prompt text, localization strings, assets, or
external model/API behavior.

## Source Matrix

| Source | Useful ideas identified | Ultrabrain decision |
| --- | --- | --- |
| `mettamatt/code-reasoning` / `@mettamatt/code-reasoning` | Branch and revision semantics; programming-focused prompt templates; JSON-first result shape; resources and prompts as MCP affordances. | Reimplemented as `ultrabrain_think`, `ultrabrain_branch`, built-in LCV templates, prompts, and JSON/markdown/text format support. No public compatibility alias is exposed. |
| `evalops/deep-code-reasoning-mcp` and the mcpservers.org mirror | Analysis-type taxonomy, hypothesis testing, cross-system impact framing, performance and tradeoff analysis. | Reimplemented as `mode`, `step_type`, `hypothesis`, `verification`, alternatives, risks, and validation checks. No external Gemini/API escalation model is included. |
| Official sequential thinking package | Linear thought chain, total-thought adjustment, branch-from-thought and revision fields. | Preserved as generic reasoning mechanics inside Ultrabrain fields, with LCV-branded tool names only. |
| `bpradana/sequentialthinking` | Session lifecycle tools, branch and merge operations, logic validation, session export, metrics, resources, prompt templates, step types. | Added `ultrabrain_start`, `ultrabrain_update`, `ultrabrain_merge`, `ultrabrain_validate`, `ultrabrain_metrics`, `ultrabrain_review`, resources, prompts, and step types. |
| `@iflow-mcp/hyokunkwak-sequential-thinking-ultra` | Quality metrics, query rewriting, budget modes, confidence, meta checkpoints, bias detection, plugin/cache/i18n concepts. | Added clean en-US quality metrics, simple query normalization, budget/confidence/meta-checkpoint/bias support. Plugin/cache/i18n were intentionally not imported for v01.00.00. All non-English strings are excluded. |
| `VitalyMalakanov/mcp-thinking` | Multiple thinking modes, session analysis/export/reflection. | Added expanded Ultrabrain reasoning modes and `ultrabrain_analyze`; no Russian localization or text copied. |
| `LeandroPG19/cuba-thinking` | Cognitive pipeline ideas: define, research, analyze, hypothesize, verify, synthesize; anti-hallucination posture; metacognition; rollback. | Reimplemented as LCV `step_type` values, verification requirements, evidence-first scoring, and validation recommendations. No code or text copied because the project has a non-commercial share-alike license posture. |
| `FradSer/mcp-server-mas-sequential-thinking` | Multi-perspective reasoning, complexity analysis, and synthesis from several views. | Added optional `perspective`, branch merge, and synthesis support. External agent/search dependencies were not imported. |
| `ssdeanx/branch-thinking-mcp` | Branch management, cross-reference thinking, analytics/cache direction. | Added branch records, merge synthesis, review tree, and metrics. Visualization/cache are deferred. |
| `Kuon-dev/advanced-reason-mcp` | External-model orchestration and advanced reasoning handoff. | Not imported. Ultrabrain remains local-first and does not call external LLM APIs. |

## v01.00.00 Included Ideas

- LCV-only public MCP tool names with the `ultrabrain_*` prefix.
- Session creation, status, history, reset, review, export, prompts, resources,
  and metrics.
- Branching, revisions, branch merge, and tree/linear/summary review.
- Reasoning modes and step types for architecture, bug analysis, planning,
  refactoring, security review, verification, synthesis, and decision work.
- Evidence, assumptions, open questions, alternatives, risks, next actions,
  confidence, budget mode, quality metrics, and bias detection.
- En-US runtime messages and documentation.

## Explicit Exclusions

- No old public tool names as aliases.
- No copied third-party source code, docs, prompt text, or assets.
- No Korean, Japanese, Chinese, or Russian localization strings.
- No cloud model escalation or external LLM/API calls.
- No global package junction to the development checkout.
