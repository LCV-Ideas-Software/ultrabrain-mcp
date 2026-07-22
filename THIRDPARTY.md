# Third-Party Notices

Direct runtime dependencies:

- `zod`, MIT

Bundled runtime component and build-only dependencies:

- `@modelcontextprotocol/sdk`, MIT (reachable stdio subset is bundled)
- `esbuild`, MIT (development only)

Development dependencies:

- `typescript`, Apache-2.0
- `@types/node`, MIT
- `prettier`, MIT

See `package-lock.json` after installation for the full transitive dependency
tree.

The package build writes the complete license texts for the exact components
incorporated into the stdio bundle to `dist/THIRD_PARTY_LICENSES.txt`.

Research-only references:

- Several public MCP reasoning servers and sequential reasoning tools were
  inspected before the first Ultrabrain release. See
  `docs/research-matrix.md`.
- No third-party source code, public tool branding, localized strings, prompt
  text, or external model/API implementation was copied into Ultrabrain.
