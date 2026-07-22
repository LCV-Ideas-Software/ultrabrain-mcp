import { createHash, timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { assertCanonicalSha512Sri, canonicalSha512Sri } from "./release-policy.mjs";

const REPOSITORY = "LCV-Ideas-Software/ultrabrain-mcp";
const REPOSITORY_ID = "1236279848";
const REPOSITORY_OWNER_ID = "279524964";
const OPERATOR = { login: "lcv-leo", id: "268063598" };
const AUTOMATION = { login: "github-actions[bot]", id: "41898282" };
const PUBLISH_WORKFLOW = { id: "275133470", path: ".github/workflows/publish.yml" };
const RECOVERY_ENVIRONMENT = "historical-release-recovery";
const RECOVERY_WORKFLOW_REF = `${REPOSITORY}/.github/workflows/recover-historical-releases.yml@refs/heads/main`;
const PACKAGE_NAME = "@lcv-ideas-software/ultrabrain-mcp";

function releaseBody(version, sri) {
  return [
    "Published package:",
    "",
    `- npmjs.com: https://www.npmjs.com/package/${PACKAGE_NAME}/v/${version}`,
    `- GitHub Packages: https://github.com/${REPOSITORY}/packages`,
    "",
    "Both registries received the same SHA-256-verified package tarball.",
    `Canonical package SRI: ${sri}`,
    "See CHANGELOG.md for the release history.",
  ].join("\n");
}

const V125_SRI =
  "sha512-TlmBgX2b7XEGao77DD/zkBxzIqZuLPTe9MszYzIPY/ZkoUrDGGk+cS9oFqlufVZmQpgdnvlBUzQYj86tJP+k7g==";
const V126_SRI =
  "sha512-eAPYyiK+alMQ24R4ZsAPrVU8HgaDYltCCADFnqmuOBF8F2GN8PCwvsIZ8K6oDXsu7yBtFEVP0O+wYBg6w1gFHA==";

export const HISTORICAL_RELEASES = Object.freeze({
  "v01.02.04": Object.freeze({
    recoverable: false,
    tag: "v01.02.04",
    version: "1.2.4",
    tagSha: "ca752b5a2ac27b62654b9a309d1f1185c8b038fd",
    candidateReleaseIds: [358159754, 358213427],
    candidateSources: [
      {
        runId: 29937668007,
        artifact: {
          id: 8536818544,
          archiveSize: 278034,
          archiveSha256: "b03f9947c9b7a75b71543876d40dd589e71b40f9bb82b490620862ca70ff1d8b",
        },
      },
      {
        runId: 29944483777,
        artifact: {
          id: 8539562391,
          archiveSize: 278034,
          archiveSha256: "76f95b0bcdc127cdf5ebbe93f84a647656c5653cf68383438567debeaad8eaf9",
        },
      },
    ],
    package: {
      tarball: "lcv-ideas-software-ultrabrain-mcp-1.2.4.tgz",
      size: 277834,
      sha256: "11d4a8315fdc775b61071a14bf04f34dc04768105ada1804f9bc29571a675118",
      sri: "sha512-bvHo0I+K/g5Ory0BxwLydP9KO5WZ31AnaF64rd4trjlDIMuPRQxbCqWbaHwi6Duts9dbQHTXFzW6BFJOubiCRA==",
    },
    blockedReason:
      "No authoritative run-to-draft binding exists for release ids 358159754 and 358213427; timestamps and list order are not a provenance contract.",
  }),
  "v01.02.05": Object.freeze({
    recoverable: true,
    tag: "v01.02.05",
    version: "1.2.5",
    tagSha: "3cf54784d9ccce2c659e554befda91172163c9a7",
    release: {
      id: 358220705,
      targetCommitish: "main",
      name: "ultrabrain-mcp v01.02.05",
      body: releaseBody("1.2.5", V125_SRI),
    },
    source: {
      runId: 29945360970,
      artifact: {
        id: 8539912901,
        archiveSize: 278221,
        archiveSha256: "6aeabe0346839288f0a203de258b69bc69bdc5e7c4c1589412cba4474e29a72b",
      },
      jobs: [
        {
          id: 89009259502,
          name: "Pre-publish gate (test + immutable artifact)",
          conclusion: "success",
          requiredSteps: [
            "Validate protected tag trigger",
            "Require owner-enforced immutable GitHub Releases",
            "Verify tag, checkout, trigger, and main ancestry",
            "Verify",
            "Verify public formatting",
            "Verify package contents",
            "Revalidate protected release identity after local validation",
            "Pack the immutable release artifact",
            "Upload immutable package artifact",
          ],
        },
        {
          id: 89009426578,
          name: "Publish immutable artifact to npmjs.com",
          conclusion: "success",
          requiredSteps: [
            "Download immutable package artifact",
            "Verify package artifact digest",
            "Check npmjs.com package version",
            "Revalidate identity and publish immutable artifact to npmjs.com",
            "Verify npmjs.com public visibility",
            "Verify npmjs.com latest remained monotonic",
          ],
        },
        {
          id: 89009426597,
          name: "Publish immutable artifact to GitHub Packages",
          conclusion: "success",
          requiredSteps: [
            "Download immutable package artifact",
            "Verify package artifact digest",
            "Check GitHub Packages version",
            "Revalidate identity and publish the same artifact to GitHub Packages",
            "Verify GitHub Packages visibility",
            "Verify GitHub Packages latest remained monotonic",
          ],
        },
        {
          id: 89009556117,
          name: "Create GitHub Release from immutable artifact",
          conclusion: "failure",
          requiredSteps: [
            "Download immutable package artifact",
            "Verify package artifact digest",
            "Create release notes",
            "Revalidate identity and reconcile the GitHub Release",
          ],
          stepConclusions: {
            "Revalidate identity and reconcile the GitHub Release": "failure",
          },
        },
      ],
    },
    package: {
      tarball: "lcv-ideas-software-ultrabrain-mcp-1.2.5.tgz",
      size: 278021,
      sha256: "450ddf98bd5f9f3d39414d5641308b144643ed35e5812d3c0f63c1d63f499016",
      sri: V125_SRI,
    },
  }),
  "v01.02.06": Object.freeze({
    recoverable: true,
    tag: "v01.02.06",
    version: "1.2.6",
    tagSha: "caa1e674be48e24ccb91949364c2845e9aa4e09c",
    release: {
      id: 358239662,
      targetCommitish: "main",
      name: "ultrabrain-mcp v01.02.06",
      body: releaseBody("1.2.6", V126_SRI),
    },
    source: {
      runId: 29947725605,
      artifact: {
        id: 8540849394,
        archiveSize: 278355,
        archiveSha256: "06e63925a55e046bfbb9537422bbaad3e6b926f8842f3f3a33e59c25513496e1",
      },
      jobs: [
        {
          id: 89017341132,
          name: "Pre-publish gate (test + immutable artifact)",
          conclusion: "success",
          requiredSteps: [
            "Validate protected tag trigger",
            "Require owner-enforced immutable GitHub Releases",
            "Verify tag, checkout, trigger, and main ancestry",
            "Verify",
            "Verify public formatting",
            "Verify package contents",
            "Revalidate protected release identity after local validation",
            "Pack the immutable release artifact",
            "Upload immutable package artifact",
          ],
        },
        {
          id: 89017476236,
          name: "Publish immutable artifact to npmjs.com",
          conclusion: "success",
          requiredSteps: [
            "Download immutable package artifact",
            "Verify package artifact digest",
            "Check npmjs.com package version",
            "Revalidate identity and publish immutable artifact to npmjs.com",
            "Verify npmjs.com public visibility",
            "Verify npmjs.com latest remained monotonic",
          ],
        },
        {
          id: 89017476181,
          name: "Publish immutable artifact to GitHub Packages",
          conclusion: "success",
          requiredSteps: [
            "Download immutable package artifact",
            "Verify package artifact digest",
            "Check GitHub Packages version",
            "Revalidate identity and publish the same artifact to GitHub Packages",
            "Verify GitHub Packages visibility",
            "Verify GitHub Packages latest remained monotonic",
          ],
        },
        {
          id: 89017616831,
          name: "Create GitHub Release from immutable artifact",
          conclusion: "failure",
          requiredSteps: [
            "Download immutable package artifact",
            "Verify package artifact digest",
            "Create release notes",
            "Revalidate identity and reconcile the GitHub Release",
          ],
          stepConclusions: {
            "Revalidate identity and reconcile the GitHub Release": "failure",
          },
        },
      ],
    },
    package: {
      tarball: "lcv-ideas-software-ultrabrain-mcp-1.2.6.tgz",
      size: 278155,
      sha256: "65feee59fe7a6fe1352d52e70d01d1b421f9538c033f5adf7342d427edb7e241",
      sri: V126_SRI,
    },
  }),
});

export const LATEST_RELEASE = Object.freeze({
  id: "358281062",
  tag: "v01.02.07",
  tagSha: "e1163f2e752890877743c234b1f897033299ba74",
  author: AUTOMATION,
  asset: {
    id: "486361797",
    name: "lcv-ideas-software-ultrabrain-mcp-1.2.7.tgz",
    size: 278290,
    sha256: "f9aefd88a42fcb9fe5cd8a445eefefdd7f26a9d3b60201b0d95f016f8602276f",
    digest: "sha256:f9aefd88a42fcb9fe5cd8a445eefefdd7f26a9d3b60201b0d95f016f8602276f",
  },
});

function fail(message) {
  throw new Error(message);
}

function exact(actual, expected, label) {
  if (String(actual ?? "") !== String(expected)) {
    fail(`${label} changed (expected ${expected}, found ${actual ?? "missing"})`);
  }
}

function exactBoolean(actual, expected, label) {
  if (typeof actual !== "boolean" || actual !== expected) {
    fail(`${label} changed (expected ${expected}, found ${String(actual)})`);
  }
}

function exactIdentity(actual, expected, label) {
  if (!actual || typeof actual !== "object") fail(`${label} identity is missing`);
  exact(actual.login, expected.login, `${label} login`);
  exact(actual.id, expected.id, `${label} id`);
}

function requireSha(value, label) {
  if (typeof value !== "string" || !/^[0-9a-f]{40}$/.test(value)) {
    fail(`${label} is not an exact lowercase commit SHA`);
  }
}

function requireObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail(`${label} must be one JSON object`);
  }
  return value;
}

function requirePositiveInteger(value, label) {
  if (!Number.isSafeInteger(value) || value < 1) {
    fail(`${label} must be a positive safe integer`);
  }
  return value;
}

function requireNonEmptyString(value, label) {
  if (typeof value !== "string" || value.length < 1) {
    fail(`${label} must be a non-empty string`);
  }
  return value;
}

function exactKeys(value, expectedKeys, label) {
  requireObject(value, label);
  const actualKeys = Object.keys(value).sort();
  const sortedExpected = [...expectedKeys].sort();
  exact(actualKeys.join(","), sortedExpected.join(","), `${label} keys`);
}

function secureDigestEqual(actual, expected, label) {
  if (typeof actual !== "string" || typeof expected !== "string") {
    fail(`${label} is missing`);
  }
  const actualBytes = Buffer.from(actual);
  const expectedBytes = Buffer.from(expected);
  if (actualBytes.length !== expectedBytes.length || !timingSafeEqual(actualBytes, expectedBytes)) {
    fail(`${label} changed (expected ${expected}, found ${actual})`);
  }
}

export function assertRecoverableRecord(item) {
  requireObject(item, "Historical release record");
  if (item.recoverable !== true) {
    fail(item.blockedReason || "Historical release is not recoverable");
  }
  return item;
}

export function getHistoricalRelease(tag) {
  const item = HISTORICAL_RELEASES[tag];
  if (!item) fail(`Unsupported historical release tag: ${tag || "<empty>"}`);
  return item;
}

export function expectedConfirmation(item) {
  assertRecoverableRecord(item);
  return (
    `RECOVER ${item.tag} RELEASE ${item.release.id} FROM RUN ${item.source.runId} ` +
    `ARTIFACT ${item.source.artifact.id}`
  );
}

export function validateDispatchContext(context, item, confirmation) {
  assertRecoverableRecord(item);
  requireObject(context, "Dispatch context");
  exact(context.eventName, "workflow_dispatch", "Event name");
  exact(context.repository, REPOSITORY, "Repository");
  exact(context.repositoryId, REPOSITORY_ID, "Repository id");
  exact(context.actor, OPERATOR.login, "Dispatch actor");
  exact(context.actorId, OPERATOR.id, "Dispatch actor id");
  exact(context.triggeringActor, OPERATOR.login, "Triggering actor");
  exact(context.ref, "refs/heads/main", "Dispatch ref");
  exact(context.workflowRef, RECOVERY_WORKFLOW_REF, "Workflow ref");
  requireSha(context.sha, "Dispatch SHA");
  requireSha(context.workflowSha, "Workflow SHA");
  exact(context.workflowSha, context.sha, "Workflow SHA");
  exact(confirmation, expectedConfirmation(item), "Typed confirmation");
  return true;
}

export function validateSourceRun(run, item) {
  assertRecoverableRecord(item);
  requireObject(run, "Source workflow run");
  exact(run.id, item.source.runId, "Source run id");
  exact(run.workflow_id, PUBLISH_WORKFLOW.id, "Source workflow id");
  exact(run.name, "Publish", "Source workflow name");
  exact(run.path, PUBLISH_WORKFLOW.path, "Source workflow path");
  exact(run.event, "workflow_dispatch", "Source run event");
  exact(run.head_branch, item.tag, "Source run head branch");
  exact(run.head_sha, item.tagSha, "Source run head SHA");
  exact(run.status, "completed", "Source run status");
  exact(run.conclusion, "failure", "Source run conclusion");
  exact(run.run_attempt, 1, "Source run attempt");
  exactIdentity(run.actor, AUTOMATION, "Source run actor");
  exactIdentity(run.triggering_actor, AUTOMATION, "Source run triggering actor");
  exact(run.repository?.id, REPOSITORY_ID, "Source run repository id");
  exact(run.head_repository?.id, REPOSITORY_ID, "Source run head repository id");
  return true;
}

export function validateSourceJobs(payload, item) {
  assertRecoverableRecord(item);
  requireObject(payload, "Source jobs payload");
  if (!Array.isArray(payload.jobs)) fail("Source jobs payload is missing jobs");
  exact(payload.total_count, item.source.jobs.length, "Source job count");
  exact(payload.jobs.length, item.source.jobs.length, "Returned source job count");

  for (const expectedJob of item.source.jobs) {
    const matches = payload.jobs.filter((job) => String(job.id) === String(expectedJob.id));
    if (matches.length !== 1) {
      fail(`Expected exactly one source job id ${expectedJob.id}, found ${matches.length}`);
    }
    const [job] = matches;
    exact(job.name, expectedJob.name, `Source job ${expectedJob.id} name`);
    exact(job.status, "completed", `Source job ${expectedJob.id} status`);
    exact(job.conclusion, expectedJob.conclusion, `Source job ${expectedJob.id} conclusion`);
    exact(job.head_sha, item.tagSha, `Source job ${expectedJob.id} head SHA`);
    if (!Array.isArray(job.steps)) fail(`Source job ${expectedJob.id} steps are missing`);
    for (const stepName of expectedJob.requiredSteps) {
      const steps = job.steps.filter((step) => step.name === stepName);
      if (steps.length !== 1) {
        fail(`Expected exactly one ${stepName} step in source job ${expectedJob.id}`);
      }
      const [step] = steps;
      exact(step.status, "completed", `${stepName} step status`);
      exact(
        step.conclusion,
        expectedJob.stepConclusions?.[stepName] ?? "success",
        `${stepName} step conclusion`,
      );
    }
  }
  return true;
}

export function validateArtifactSet(payload, item) {
  assertRecoverableRecord(item);
  requireObject(payload, "Artifact set");
  if (!Array.isArray(payload.artifacts)) fail("Artifact set is missing artifacts");
  exact(payload.total_count, 1, "Source artifact count");
  exact(payload.artifacts.length, 1, "Returned source artifact count");
  const [artifact] = payload.artifacts;
  exact(artifact.id, item.source.artifact.id, "Source artifact id");
  exact(artifact.name, "release-package-tgz", "Source artifact name");
  exact(artifact.size_in_bytes, item.source.artifact.archiveSize, "Source artifact archive size");
  exactBoolean(artifact.expired, false, "Source artifact expired state");
  secureDigestEqual(
    artifact.digest,
    `sha256:${item.source.artifact.archiveSha256}`,
    "Source artifact digest",
  );
  exact(artifact.workflow_run?.id, item.source.runId, "Artifact workflow run id");
  exact(artifact.workflow_run?.repository_id, REPOSITORY_ID, "Artifact workflow repository id");
  exact(
    artifact.workflow_run?.head_repository_id,
    REPOSITORY_ID,
    "Artifact workflow head repository id",
  );
  exact(artifact.workflow_run?.head_branch, item.tag, "Artifact workflow head branch");
  exact(artifact.workflow_run?.head_sha, item.tagSha, "Artifact workflow head SHA");
  return true;
}

export function validateImmutablePolicy(policy) {
  requireObject(policy, "Immutable release policy");
  exactBoolean(policy.enabled, true, "Immutable release policy enabled state");
  exactBoolean(policy.enforced_by_owner, true, "Immutable release policy owner enforcement state");
  return true;
}

export function validateRecoveryEnvironment(environment, branchPolicies) {
  requireObject(environment, "Recovery environment");
  exact(environment.name, RECOVERY_ENVIRONMENT, "Recovery environment name");
  exact(
    environment.url,
    `https://api.github.com/repos/${REPOSITORY}/environments/${RECOVERY_ENVIRONMENT}`,
    "Recovery environment URL",
  );
  requirePositiveInteger(environment.id, "Recovery environment id");
  requireNonEmptyString(environment.node_id, "Recovery environment node id");
  requireObject(environment.deployment_branch_policy, "Recovery deployment branch policy");
  exactBoolean(
    environment.deployment_branch_policy.protected_branches,
    false,
    "Recovery protected-branches state",
  );
  exactBoolean(
    environment.deployment_branch_policy.custom_branch_policies,
    true,
    "Recovery custom-branch-policies state",
  );
  if (!Array.isArray(environment.protection_rules)) {
    fail("Recovery environment protection rules are missing");
  }
  exact(environment.protection_rules.length, 1, "Recovery protection rule count");
  const [protectionRule] = environment.protection_rules;
  requireObject(protectionRule, "Recovery protection rule");
  exact(protectionRule.type, "branch_policy", "Recovery protection rule type");
  requirePositiveInteger(protectionRule.id, "Recovery protection rule id");
  requireNonEmptyString(protectionRule.node_id, "Recovery protection rule node id");

  requireObject(branchPolicies, "Recovery deployment branch policies");
  if (!Array.isArray(branchPolicies.branch_policies)) {
    fail("Recovery deployment branch policy list is missing");
  }
  exact(branchPolicies.total_count, 1, "Recovery deployment branch policy count");
  exact(branchPolicies.branch_policies.length, 1, "Returned recovery branch policy count");
  const [branchPolicy] = branchPolicies.branch_policies;
  requireObject(branchPolicy, "Recovery deployment branch policy");
  exact(branchPolicy.name, "main", "Recovery deployment branch policy name");
  exact(branchPolicy.type, "branch", "Recovery deployment branch policy type");
  requirePositiveInteger(branchPolicy.id, "Recovery deployment branch policy id");
  requireNonEmptyString(branchPolicy.node_id, "Recovery deployment branch policy node id");
  return {
    environmentId: String(environment.id),
    protectionRuleId: String(protectionRule.id),
    branchPolicyId: String(branchPolicy.id),
  };
}

function validateAsset(asset, item, expectedAssetId = "") {
  requireObject(asset, "Release asset");
  if (expectedAssetId) exact(asset.id, expectedAssetId, "Release asset id");
  exact(asset.name, item.package.tarball, "Release asset name");
  exact(asset.state, "uploaded", "Release asset state");
  exact(asset.size, item.package.size, "Release asset size");
  secureDigestEqual(asset.digest, `sha256:${item.package.sha256}`, "Release asset digest");
  exactIdentity(asset.uploader, AUTOMATION, "Release asset uploader");
  return String(asset.id);
}

export function validateLatestRelease(release) {
  requireObject(release, "Latest release");
  exact(release.id, LATEST_RELEASE.id, "Latest release id");
  exact(release.tag_name, LATEST_RELEASE.tag, "Latest release tag");
  exactBoolean(release.draft, false, "Latest release draft state");
  exactBoolean(release.prerelease, false, "Latest release prerelease state");
  exactBoolean(release.immutable, true, "Latest release immutable state");
  exactIdentity(release.author, LATEST_RELEASE.author, "Latest release author");
  if (!Array.isArray(release.assets) || release.assets.length !== 1) {
    fail(
      `Latest release must have exactly one asset, found ${release.assets?.length ?? "invalid"}`,
    );
  }
  const [asset] = release.assets;
  exact(asset.id, LATEST_RELEASE.asset.id, "Latest release asset id");
  exact(asset.name, LATEST_RELEASE.asset.name, "Latest release asset name");
  exact(asset.size, LATEST_RELEASE.asset.size, "Latest release asset size");
  exact(asset.state, "uploaded", "Latest release asset state");
  secureDigestEqual(asset.digest, LATEST_RELEASE.asset.digest, "Latest release asset digest");
  exactIdentity(asset.uploader, LATEST_RELEASE.author, "Latest release asset uploader");
  return LATEST_RELEASE.tag;
}

function attestationIdentity(item) {
  requireObject(item, "Release attestation identity");
  if (item === LATEST_RELEASE) {
    return {
      releaseId: item.id,
      tag: item.tag,
      tagSha: item.tagSha,
      assetName: item.asset.name,
      assetSha256: item.asset.sha256,
    };
  }
  assertRecoverableRecord(item);
  return {
    releaseId: item.release.id,
    tag: item.tag,
    tagSha: item.tagSha,
    assetName: item.package.tarball,
    assetSha256: item.package.sha256,
  };
}

export function validateReleaseAttestation(payload, item) {
  requireObject(payload, "GitHub release verification output");
  const expected = attestationIdentity(item);
  const verification = requireObject(
    payload.verificationResult,
    "GitHub release verification result",
  );
  exact(
    verification.mediaType,
    "application/vnd.dev.sigstore.verificationresult+json;version=0.1",
    "GitHub release verification media type",
  );
  exact(
    verification.signature?.certificate?.subjectAlternativeName,
    "https://dotcom.releases.github.com",
    "GitHub release attester certificate identity",
  );

  const statement = requireObject(verification.statement, "GitHub release statement");
  exactKeys(
    statement,
    ["_type", "subject", "predicateType", "predicate"],
    "GitHub release statement",
  );
  exact(statement._type, "https://in-toto.io/Statement/v1", "GitHub release statement type");
  exact(
    statement.predicateType,
    "https://in-toto.io/attestation/release/v0.2",
    "GitHub release predicate type",
  );

  const purl = `pkg:github/${REPOSITORY}@${expected.tag}`;
  const predicate = requireObject(statement.predicate, "GitHub release predicate");
  exactKeys(
    predicate,
    ["databaseId", "ownerId", "packageId", "purl", "repository", "repositoryId", "tag"],
    "GitHub release predicate",
  );
  exact(predicate.databaseId, expected.releaseId, "Attested release id");
  exact(predicate.ownerId, REPOSITORY_OWNER_ID, "Attested repository owner id");
  exact(predicate.packageId, REPOSITORY_ID, "Attested package id");
  exact(predicate.repositoryId, REPOSITORY_ID, "Attested repository id");
  exact(predicate.repository, REPOSITORY, "Attested repository");
  exact(predicate.tag, expected.tag, "Attested tag");
  exact(predicate.purl, purl, "Attested package URL");

  if (!Array.isArray(statement.subject) || statement.subject.length !== 2) {
    fail(
      `GitHub release statement must have exactly two subjects, found ${statement.subject?.length ?? "invalid"}`,
    );
  }
  const releaseSubjects = statement.subject.filter((subject) => subject?.uri === purl);
  const assetSubjects = statement.subject.filter((subject) => subject?.name === expected.assetName);
  exact(releaseSubjects.length, 1, "Attested release subject count");
  exact(assetSubjects.length, 1, "Attested asset subject count");
  const [releaseSubject] = releaseSubjects;
  const [assetSubject] = assetSubjects;
  exactKeys(releaseSubject, ["uri", "digest"], "Attested release subject");
  exactKeys(releaseSubject.digest, ["sha1"], "Attested release digest");
  exact(releaseSubject.digest.sha1, expected.tagSha, "Attested release tag SHA");
  exactKeys(assetSubject, ["name", "digest"], "Attested asset subject");
  exactKeys(assetSubject.digest, ["sha256"], "Attested asset digest");
  secureDigestEqual(assetSubject.digest.sha256, expected.assetSha256, "Attested asset SHA-256");
  return true;
}

export function validateTaggedPackage(packageJson, item) {
  assertRecoverableRecord(item);
  requireObject(packageJson, "Tagged package.json");
  exact(packageJson.name, PACKAGE_NAME, "Tagged package name");
  exact(packageJson.version, item.version, "Tagged package version");
  return true;
}

function releasePages(payload) {
  if (!Array.isArray(payload)) fail("Release listing must be an array");
  if (payload.every(Array.isArray)) return payload.flat();
  if (payload.some(Array.isArray)) fail("Release listing has mixed page shapes");
  return payload;
}

export function validateReleaseList(payload, item) {
  assertRecoverableRecord(item);
  const matches = releasePages(payload).filter((release) => release?.tag_name === item.tag);
  if (matches.length !== 1) {
    fail(`Expected exactly one release for ${item.tag}, found ${matches.length}`);
  }
  exact(matches[0].id, item.release.id, "Historical release id");
  validateReleaseSnapshot(matches[0], item, "preflight");
  return matches[0];
}

export function validateReleaseSnapshot(release, item, phase, expectedAssetId = "") {
  assertRecoverableRecord(item);
  requireObject(release, "Historical release snapshot");
  exact(release.id, item.release.id, "Historical release id");
  exact(release.tag_name, item.tag, "Historical release tag");
  exact(release.target_commitish, item.release.targetCommitish, "Historical release target");
  exact(release.name, item.release.name, "Historical release name");
  exact(release.body, item.release.body, "Historical release body");
  exactBoolean(release.prerelease, false, "Historical release prerelease state");
  exactIdentity(release.author, AUTOMATION, "Historical release author");
  if (!Array.isArray(release.assets)) fail("Historical release assets are missing");

  if (phase === "preflight") {
    if (release.draft === true) {
      exactBoolean(release.immutable, false, "Draft release immutable state");
    } else {
      exactBoolean(release.draft, false, "Historical release draft state");
      exactBoolean(release.immutable, true, "Published release immutable state");
    }
    if (release.assets.length > 1) {
      fail(`Historical release must have at most one asset, found ${release.assets.length}`);
    }
  } else if (phase === "staged") {
    exactBoolean(release.draft, true, "Staged release draft state");
    exactBoolean(release.immutable, false, "Staged release immutable state");
    if (release.assets.length !== 1) {
      fail(`Staged release must have exactly one asset, found ${release.assets.length}`);
    }
  } else if (phase === "published-pending") {
    exactBoolean(release.draft, false, "Published release draft state");
    if (typeof release.immutable !== "boolean") {
      fail("Published release immutable state is invalid");
    }
    if (release.assets.length !== 1) {
      fail(`Published release must have exactly one asset, found ${release.assets.length}`);
    }
  } else if (phase === "final") {
    exactBoolean(release.draft, false, "Final release draft state");
    exactBoolean(release.immutable, true, "Final release immutable state");
    if (release.assets.length !== 1) {
      fail(`Final release must have exactly one asset, found ${release.assets.length}`);
    }
  } else {
    fail(`Unknown release validation phase: ${phase || "<empty>"}`);
  }

  if (release.assets.length === 0) return "";
  return validateAsset(release.assets[0], item, expectedAssetId);
}

export async function uploadReleaseAsset({ item, assetPath, token, fetchImpl = fetch }) {
  assertRecoverableRecord(item);
  if (typeof token !== "string" || token.length < 1) fail("Recovery GitHub token is missing");
  if (basename(assetPath) !== item.package.tarball) {
    fail(`Recovery asset path must end in ${item.package.tarball}`);
  }
  const bytes = readFileSync(assetPath);
  exact(bytes.length, item.package.size, "Recovery asset byte size");
  secureDigestEqual(
    createHash("sha256").update(bytes).digest("hex"),
    item.package.sha256,
    "Recovery asset SHA-256",
  );
  assertCanonicalSha512Sri(item.package.sri, "Recovery manifest SRI");
  secureDigestEqual(canonicalSha512Sri(bytes), item.package.sri, "Recovery asset SRI");

  const assetName = encodeURIComponent(item.package.tarball);
  const url =
    `https://uploads.github.com/repos/${REPOSITORY}/releases/${item.release.id}/assets` +
    `?name=${assetName}`;
  const response = await fetchImpl(url, {
    method: "POST",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/octet-stream",
      "X-GitHub-Api-Version": "2026-03-10",
    },
    body: bytes,
    redirect: "error",
  });
  const responseText = await response.text();
  if (response.status !== 201) {
    fail(`Exact release asset upload failed with HTTP ${response.status}`);
  }
  let asset;
  try {
    asset = JSON.parse(responseText);
  } catch {
    fail("Exact release asset upload returned invalid JSON");
  }
  validateAsset(asset, item);
  return asset;
}

function readJson(path, label) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    fail(`${label} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function runCli(args) {
  const [command, tag] = args;
  if (!command) fail("Missing historical release recovery command");
  if (command === "validate-policy") {
    validateImmutablePolicy(readJson(args[2], "Immutable release policy"));
    return;
  }
  if (command === "validate-latest") {
    console.log(validateLatestRelease(readJson(args[2], "Latest release")));
    return;
  }
  if (command === "latest-manifest") {
    console.log(JSON.stringify(LATEST_RELEASE));
    return;
  }
  if (command === "validate-latest-attestation") {
    validateReleaseAttestation(readJson(args[2], "Latest release attestation"), LATEST_RELEASE);
    return;
  }
  if (command === "validate-environment") {
    console.log(
      JSON.stringify(
        validateRecoveryEnvironment(
          readJson(args[2], "Recovery environment"),
          readJson(args[3], "Recovery deployment branch policies"),
        ),
      ),
    );
    return;
  }
  const item = tag ? getHistoricalRelease(tag) : undefined;
  if (command === "manifest") {
    console.log(JSON.stringify(item));
    return;
  }
  if (command === "expected-confirmation") {
    console.log(expectedConfirmation(item));
    return;
  }
  if (command === "validate-dispatch") {
    validateDispatchContext(readJson(args[3], "Dispatch context"), item, args[2]);
    return;
  }
  if (command === "validate-run") {
    validateSourceRun(readJson(args[2], "Source run"), item);
    return;
  }
  if (command === "validate-jobs") {
    validateSourceJobs(readJson(args[2], "Source jobs"), item);
    return;
  }
  if (command === "validate-artifacts") {
    validateArtifactSet(readJson(args[2], "Source artifacts"), item);
    return;
  }
  if (command === "validate-release-list") {
    const release = validateReleaseList(readJson(args[2], "Release listing"), item);
    console.log(String(release.id));
    return;
  }
  if (command === "validate-release") {
    const assetId = validateReleaseSnapshot(
      readJson(args[2], "Historical release"),
      item,
      args[3],
      args[4] || "",
    );
    console.log(assetId);
    return;
  }
  if (command === "validate-package") {
    validateTaggedPackage(readJson(args[2], "Tagged package.json"), item);
    return;
  }
  if (command === "validate-attestation") {
    validateReleaseAttestation(readJson(args[2], "Historical release attestation"), item);
    return;
  }
  if (command === "upload-asset") {
    const token = process.env.RECOVERY_GITHUB_TOKEN || "";
    delete process.env.RECOVERY_GITHUB_TOKEN;
    const asset = await uploadReleaseAsset({ item, assetPath: args[2], token });
    console.log(JSON.stringify(asset));
    return;
  }
  fail(`Unknown historical release recovery command: ${command}`);
}

const directInvocation =
  process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (directInvocation) {
  runCli(process.argv.slice(2)).catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
