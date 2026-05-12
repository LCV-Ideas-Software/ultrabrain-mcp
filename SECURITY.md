# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in this repository, please do not open
a public issue. Report it privately to the repository maintainer.

Contact: alert@lcvmail.com

## Threat Model

`ultrabrain-mcp` is a local stdio MCP server for a single trusted workstation.
It stores reasoning history in memory only and does not call external LLM APIs.

Important boundaries:

- Do not expose this server as a network service without an authenticating wrapper.
- Do not place secrets in reasoning thoughts unless the host already treats MCP
  transcript data as sensitive.
- Do not commit `.env`, host credentials, MCP bearer tokens, or `node_modules/`.

## Dependency and Supply Chain

- Local validation runs `npm test`.
- Publishing should use npm Trusted Publishing with provenance when enabled.
