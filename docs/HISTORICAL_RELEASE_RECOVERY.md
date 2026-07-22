# Historical GitHub Release recovery

This runbook covers the narrowly scoped recovery of the historical GitHub
Release drafts for `v01.02.04`, `v01.02.05`, and `v01.02.06`. It does not
publish packages, move or recreate tags, delete releases or assets, or change
an npm dist-tag. The already published, immutable `v01.02.07` release must
remain the latest release throughout the operation.

The recovery workflow is intentionally fail-closed. All live identities and
digests are frozen in `scripts/historical-release-recovery.mjs`; any drift
requires a separately reviewed change instead of a runtime guess.

## Recovery inventory

| Tag         |                  GitHub Release |                      Source run |               Source artifact | State                                          |
| ----------- | ------------------------------: | ------------------------------: | ----------------------------: | ---------------------------------------------- |
| `v01.02.04` | `358159754` **and** `358213427` | `29937668007` and `29944483777` | `8536818544` and `8539562391` | Blocked: no authoritative run-to-draft binding |
| `v01.02.05` |                     `358220705` |                   `29945360970` |                  `8539912901` | Recoverable after all live gates pass          |
| `v01.02.06` |                     `358239662` |                   `29947725605` |                  `8540849394` | Recoverable after all live gates pass          |

The immutable latest release is exactly release `358281062`, tag
`v01.02.07`, with asset `486361797`. A different latest release, even a valid
newer one, stops this one-time workflow so that its safety proof can be
reviewed and updated explicitly.

### Why `v01.02.04` is blocked

GitHub currently exposes two draft releases for the same tag and two failed
publish runs. Both artifacts unpack to the same package bytes, and both drafts
have matching release metadata, but the Releases API does not expose a source
workflow-run field that binds either draft ID to either run ID. Creation time,
update time, API list order, and proximity to a run are correlations, not a
documented provenance contract.

Consequently, selecting, publishing, deleting, or renaming either draft would
be a guess. The workflow rejects `v01.02.04` before any API mutation and
preserves both drafts and both artifacts. Recovery can be enabled only after
authoritative evidence uniquely binds the intended release ID, such as a
GitHub audit/support record or an immutable identifier captured by the source
workflow.

## Safety architecture

The workflow performs these checks before uploading an asset and repeats the
mutation-sensitive checks immediately before publishing the draft:

1. Require a dispatch by the sole operator on `main`, where the exact workflow
   file and workflow SHA equal the checked-out commit SHA.
2. Require a tag-specific confirmation containing the exact release ID, run
   ID, and artifact ID.
3. Verify the frozen tag commit through Git, the Git reference API, and
   ancestry to the exact current `main` SHA; verify the tagged `package.json`.
4. Verify the source workflow identity, head SHA, actor IDs, run attempt, full
   job graph, required successful steps, and the one expected failed release
   step.
5. Fetch the one unexpired artifact by exact run and artifact IDs, verify its
   archive SHA-256, require exactly one ZIP entry, and verify the extracted
   tarball's byte length, SHA-256, and canonical SHA-512 SRI.
6. Compare that SRI with the already public package version on npmjs.com and
   GitHub Packages through isolated working directories and explicit scoped
   registries. No package is republished.
7. Enumerate all releases, require exactly one release with the selected tag,
   then operate through the frozen numeric release ID. Metadata, author ID,
   draft/immutable state, and asset count must match exactly.
8. Require the owner-enforced immutable-releases policy and the exact immutable
   `v01.02.07` latest release before each mutation. A safe GitHub CLI version
   must cryptographically verify both its release and downloaded exact asset;
   the returned JSON must attest the frozen repository, release ID, tag, tag
   commit SHA, asset name, and asset SHA-256.
9. Upload only when the exact draft has no asset. A retry may reuse one exact,
   matching staged asset. The workflow never deletes, overwrites, or replaces
   an asset and refuses any unexpected asset or metadata.
10. Publish by patching the exact release ID with `draft: false`,
    `prerelease: false`, and `make_latest: "false"`. Then require the same
    single asset, immutable state, unchanged latest release, matching public
    registry SRIs, exact downloaded asset bytes, and GitHub release and asset
    attestations. After `immutable: true`, the workflow reads the historical
    tag again and validates both `gh release verify --format json` outputs
    against the same frozen identities.

Immediately before the PATCH, the workflow repeats the immutable policy,
latest release, complete release listing, exact release snapshot, and exact
asset-byte checks. It then fetches `main` and the tag again; this main/tag
identity check is the final operation before the state-only PATCH. Therefore,
if `main` advances after the asset upload, the run exits while leaving the
verified asset safely staged on the draft. A later run may revalidate and reuse
it; the stale run does not publish.

The Releases API does not document a compare-and-swap token for the update
operation, so no client-side sequence can make the final reads and PATCH one
transaction. A residual network race remains between the final identity read
and the mutation. The workflow minimizes that interval, serializes every
recovery, restricts dispatch to the sole operator, and sends only the three
release-state fields in the PATCH so it cannot overwrite concurrent release
notes or other metadata.

### Registry and credential boundary

The repository's development `.npmrc` intentionally maps the package scope to
npmjs.com. npm gives a scoped registry mapping its own precedence, so merely
passing a generic `--registry=https://npm.pkg.github.com` while running from
the checkout can still query npmjs.com. The recovery workflow therefore never
runs either public-registry lookup from the project directory.

It creates separate directories under `RUNNER_TEMP`, uses explicit
`--scope`, `--registry`, and `--userconfig` arguments, and creates the GitHub
Packages npmrc with mode `0600` containing only:

```ini
@lcv-ideas-software:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}
```

The placeholder remains literal on disk. Only the exact GitHub Packages
`npm view` process receives `NODE_AUTH_TOKEN`, using the run's ephemeral
`GITHUB_TOKEN`; the token is never an argument or log value. The administrator
token is confined to immutable-policy and environment API reads and is never
given to npm. An EXIT trap validates the temporary paths and removes only the
two exact npmrc files and their empty directories, without recursive deletion.

GitHub CLI safety is checked during initial evidence collection, repeated at
the immediate asset-upload and release-PATCH boundaries, and checked again
during final verification. The known immutable
`v01.02.07` release and asset attestations are verified before either mutation.
The historical tag is fetched again after the release becomes immutable, and
the final release and asset attestation JSON is bound to the frozen release
ID, repository ID, tag SHA, asset name, and digest.

The global concurrency group uses `queue: max`, with cancellation disabled, so
recoveries are serialized without replacing a waiting run. GitHub currently
allows up to 100 pending runs in such a group. The installed `actionlint`
1.7.12 predates this syntax and reports it as unknown; this is a validator
compatibility limitation, not a GitHub workflow syntax error. Zizmor remains an
independent workflow security gate.

## Required dedicated environment

The recovery job targets `historical-release-recovery`. Do not reuse or loosen
`github-release-production`: its selected deployment rule is a `v*` **tag**,
while this workflow must be dispatched from `refs/heads/main`, so GitHub would
correctly refuse that job.

The dedicated environment must be provisioned before the first dispatch.
GitHub documents that referencing a missing environment can create it without
the intended rules. As a second fail-closed layer, the job queries the live
environment before any mutation and requires all of the following:

- environment name `historical-release-recovery`;
- custom branch policies enabled and protected-branches mode disabled;
- exactly one environment protection rule, of type `branch_policy`;
- exactly one deployment policy named `main`, of type `branch`.

An administrator must perform these two explicit REST mutations outside the
recovery workflow and retain the returned environment and policy IDs in the
change evidence. They are prerequisites, not actions performed by this PR:

```text
PUT /repos/LCV-Ideas-Software/ultrabrain-mcp/environments/historical-release-recovery
{"deployment_branch_policy":{"protected_branches":false,"custom_branch_policies":true}}

POST /repos/LCV-Ideas-Software/ultrabrain-mcp/environments/historical-release-recovery/deployment-branch-policies
{"name":"main","type":"branch"}
```

After provisioning, GET both resources and run the same validator used by the
workflow before allowing any dispatch. A missing environment, an implicitly
created unrestricted environment, a `v*` tag rule, an additional rule, or a
non-`main` branch rule all fail before an asset upload.

## Operator procedure

Do not dispatch the workflow from this pull request. `workflow_dispatch`
requires the workflow to exist on the default branch, and recovery must use
the exact trusted `main` workflow SHA.

After this change is reviewed and merged, recover one version at a time, in
historical order. Select `main` explicitly and enter the corresponding
confirmation without modification:

```text
RECOVER v01.02.05 RELEASE 358220705 FROM RUN 29945360970 ARTIFACT 8539912901
RECOVER v01.02.06 RELEASE 358239662 FROM RUN 29947725605 ARTIFACT 8540849394
```

Do not dispatch `v01.02.04`; it is present in the input choices only so an
attempt produces an explicit, auditable failure rather than silently omitting
the known incident.

An interruption or a detected `main` advance after an asset upload but before
publication leaves the draft and exact asset intact. A retry revalidates and
reuses that asset. If the release was already published and made immutable, a
retry performs only the final verification path. No cleanup action is
automated for releases, tags, or assets; only temporary local authentication
files are removed.

## Primary references

- [GitHub Actions workflow dispatch REST API](https://docs.github.com/en/rest/actions/workflows)
- [GitHub Actions workflow syntax and `workflow_dispatch`](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax)
- [GitHub Actions contexts](https://docs.github.com/en/actions/reference/workflows-and-actions/contexts)
- [Workflow runs REST API](https://docs.github.com/en/rest/actions/workflow-runs)
- [Artifacts REST API](https://docs.github.com/en/rest/actions/artifacts)
- [Releases REST API](https://docs.github.com/en/rest/releases/releases)
- [Release assets REST API](https://docs.github.com/en/rest/releases/assets)
- [Immutable releases](https://docs.github.com/en/code-security/concepts/supply-chain-security/immutable-releases)
- [Verify release integrity](https://docs.github.com/en/code-security/how-tos/secure-your-supply-chain/secure-your-dependencies/verify-release-integrity)
- [GitHub Actions concurrency queues](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency)
- [Deployment environments](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments)
- [Deployment environment REST API](https://docs.github.com/en/rest/deployments/environments)
- [Deployment branch policy REST API](https://docs.github.com/en/rest/deployments/branch-policies)
- [npm view](https://docs.npmjs.com/cli/v8/commands/npm-view/)
- [npmrc files, scoped registries, and scoped authentication](https://docs.npmjs.com/files/npmrc/)
- [GitHub Packages npm registry](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-npm-registry)
- [`gh release verify`](https://cli.github.com/manual/gh_release_verify)
- [`gh release verify-asset`](https://cli.github.com/manual/gh_release_verify-asset)

The design also accounts for maintainer and community operational evidence:

- [`softprops/action-gh-release` duplicate draft report](https://github.com/softprops/action-gh-release/issues/323)
- [`softprops/action-gh-release` maintained usage and release ID output](https://github.com/softprops/action-gh-release)
- [GitHub Community discussion: dispatching a workflow on a non-default ref](https://github.com/orgs/community/discussions/25746)
- [GitHub Community discussion: `workflow_dispatch` ref behavior](https://github.com/orgs/community/discussions/169535)
- [GitHub Community discussion: artifacts and workflow-version mismatch](https://github.com/orgs/community/discussions/24657)
