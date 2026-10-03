# Third-Party Components

The authoritative repository dependency inventory is the GitHub Dependency
Graph. GitHub can export that graph as an SPDX SBOM and applies the
organization's native License Compliance policy to it. This file intentionally
does not duplicate the graph as a hand-maintained Markdown list.

The npm package carries `dist/THIRD_PARTY_LICENSES.txt`, generated from the
esbuild metafile and the installed license files for the exact components
incorporated into the stdio bundle. `LICENSE` and `NOTICE` accompany it. This
repository-only pointer is not included in the npm tarball.

- Dependency Graph: https://github.com/LCV-Ideas-Software/ultrabrain-mcp/network/dependencies
- GitHub SBOM documentation: https://docs.github.com/en/code-security/how-tos/secure-your-supply-chain/establish-provenance-and-integrity/export-dependencies-as-sbom

Research-only references:

- Several public MCP reasoning servers and sequential reasoning tools were
  inspected before the first Ultrabrain release. See
  `docs/research-matrix.md`.
- No third-party source code, public tool branding, localized strings, prompt
  text, or external model/API implementation was copied into Ultrabrain.

## Atualização documental — 02/10/2026 (LCV-183 / LCV-211)

O Vitest 5.0.3 seleciona `why-is-node-running` 3.2.1, cuja publicação oficial não depende de `stackback`. A árvore exata permanece nos lockfiles regenerados pelo npm. Fonte: https://github.com/vitest-dev/vitest/pull/11316 e https://github.com/vitest-dev/vitest/releases/tag/v5.0.3. Esta atualização de ferramenta de teste não afirma incorporação no produto distribuído.
