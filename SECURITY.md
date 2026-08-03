# Security Policy

## Supported status

Latest supported source/release target: v01.02.09 for npm package 1.2.9. The current main branch is also supported for security fixes until the next release is published.

v01.02.09 upgrades the SHA-512-verified npm toolchain to 12.0.2 on Linux and
Windows and requires two clean-room OIDC exchange proofs before any checkout or
dependency execution: npm must return its documented `401` rejection or
identity-concealing `404` outside `npm-production` and authorize the exact
context inside it with `201`. Both probes use npm-compatible scoped-package
escaping. The positive probe discards its issued
credential without checking out code or invoking an action; only the immutable
npmjs writer uses an npm OIDC credential to publish. Registry/provenance
verification runs afterward without that environment. It also resolves the
current Hono, `fast-uri` and PostCSS advisories, plus GHSA-mwp4-54f8-5fhr,
GHSA-4xrf-jv44-h6hh and GHSA-22jq-vg5j-6vgg in `ip-address`, with 4.12.34,
3.1.5, 8.5.25 and 10.4.0 respectively. Hono 4.12.34 includes the fix for
GHSA-8j4g-w8fx-2239.

## Reporting a vulnerability

Please do not open a public issue for suspected vulnerabilities, credential leaks, private data exposure, authentication bypasses, payment-flow issues, supply-chain issues, or deployment misconfiguration.

Report privately by email:

- lcv@lcv.dev

If GitHub private vulnerability reporting is enabled for this repository, that channel is also acceptable.

Please include:

- affected repository, component, route, package, workflow, or public surface;
- affected version, release tag, commit SHA, or deployment URL when known;
- impact and exploitability;
- reproduction steps or a safe proof of concept, if available;
- whether any credential, personal data, payment data, private editorial material, or operational secret may be involved.

## Scope

In scope: application code, Workers/Pages functions, package publication, GitHub Actions, dependency and supply-chain configuration, repository publication boundaries, security documentation, and public service configuration documented in this repository.

Out of scope: social engineering, physical attacks, denial-of-service testing without prior written authorization, spam, automated noisy scanning, and reports that rely only on outdated browser or dependency versions without a concrete vulnerable path in this repository.

## Coordinated disclosure

LCV Ideas & Software will triage reports privately, request clarification when needed, and coordinate remediation before public disclosure. Public disclosure should wait until a fix or mitigation is available, unless there is an immediate user-safety reason to do otherwise.
