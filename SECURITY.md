# Security Policy

## Supported status

As verified on 08/09/2026, the latest published and supported npm package is
`1.2.15`, with GitHub Release `v01.02.15`. This source prepares
`1.2.17` / `v01.02.17`; it has not been published. The earlier
`v01.02.16` tag points to the failed publication attempt at `20738d8` and
is preserved rather than moved or reused. The development branch remains the
source for security fixes until the prepared release is published.

## Automation and credentials

The prepared native workflow has four publication jobs. A build job with
`contents: read` packs the product through npm's normal lifecycle, retaining
the bundled-component license texts and distribution verification. CI retains
the clean-consumer tests. The npmjs writer uses official npm Trusted Publishing
through OIDC in `npm-production`, without a long-lived npm publish token.
GitHub Packages then publishes the same tarball using `GITHUB_TOKEN`.
Only after both registry jobs succeed does GitHub CLI create the padded tag
and GitHub Release with the run's `contents: write` permission.

Registry writers do not check out source, install product dependencies or run
product build scripts. Direct Actions use reviewed immutable pins; their
upstream manifests still govern nested Actions. There is no administrative PAT
publication gate, custom npm bootstrap or separate auto-tag controller.

CI retains the product checks. CodeQL uses GitHub Default Setup; Dependency
Review, Zizmor and Scorecard use official repository-local workflows. Dependabot
checks npm and GitHub Actions every day at 05h (UTC−03:00), including weekends, and arms GitHub's native auto-merge for its
same-repository pull requests, including majors, subject to required checks.
It uses the organization-level Dependabot secret `DEPENDABOT_AUTOMERGE_TOKEN`;
this shared operator token is the accepted organization baseline, not a
package-publication credential.

Pages serves `site/` only from `main`. The official Linear Release integration
remains separate from package publication and uses `LINEAR_ACCESS_KEY` in its
`linear-release` environment. Repository security settings are managed
separately; workflow changes do not provision or loosen those settings.

A tag alone is not proof of publication. After an interrupted run, inspect any
partial registry or Release writes before a native failed-job rerun. Recovery
is best effort and does not provide an exactly-once guarantee. Historical
release-recovery procedures are retained as archived evidence, not active
publication machinery.

## Reporting a vulnerability

Please do not open a public issue for suspected vulnerabilities, credential leaks, private data exposure, authentication bypasses, payment-flow issues, supply-chain issues, or deployment misconfiguration.

Report privately by email:

- security@lcv.dev

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

Dependabot security fixes are grouped separately per supported ecosystem. A failing
member can delay its group, so grouped pull requests require the same security,
quality and compatibility checks as individual updates. The native schedule uses
`cronjob: "0 5 * * *"` with `timezone: "Etc/GMT+3"`; GitHub may start queued work later.
See the [official Dependabot options](https://docs.github.com/en/code-security/reference/supply-chain-security/dependabot-options-reference).
