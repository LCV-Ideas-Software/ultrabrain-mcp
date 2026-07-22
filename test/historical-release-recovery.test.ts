import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmdirSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  assertRecoverableRecord,
  expectedConfirmation,
  HISTORICAL_RELEASES,
  uploadReleaseAsset,
  validateArtifactSet,
  validateDispatchContext,
  validateImmutablePolicy,
  validateLatestRelease,
  validateRecoveryEnvironment,
  validateReleaseList,
  validateReleaseSnapshot,
  validateSourceJobs,
  validateSourceRun,
  validateTaggedPackage,
} from "../scripts/historical-release-recovery.mjs";

const workflow = readFileSync(
  new URL("../.github/workflows/recover-historical-releases.yml", import.meta.url),
  "utf8",
);

const owner = { login: "github-actions[bot]", id: 41898282 };

function record(tag = "v01.02.05") {
  return HISTORICAL_RELEASES[tag];
}

function dispatchContext(overrides = {}) {
  return {
    eventName: "workflow_dispatch",
    repository: "LCV-Ideas-Software/ultrabrain-mcp",
    repositoryId: "1236279848",
    actor: "lcv-leo",
    actorId: "268063598",
    triggeringActor: "lcv-leo",
    ref: "refs/heads/main",
    sha: "e1163f2e752890877743c234b1f897033299ba74",
    workflowRef:
      "LCV-Ideas-Software/ultrabrain-mcp/.github/workflows/recover-historical-releases.yml@refs/heads/main",
    workflowSha: "e1163f2e752890877743c234b1f897033299ba74",
    ...overrides,
  };
}

function sourceRun(tag = "v01.02.05", overrides = {}) {
  const item = record(tag);
  return {
    id: item.source.runId,
    workflow_id: 275133470,
    name: "Publish",
    path: ".github/workflows/publish.yml",
    event: "workflow_dispatch",
    head_branch: tag,
    head_sha: item.tagSha,
    status: "completed",
    conclusion: "failure",
    run_attempt: 1,
    actor: owner,
    triggering_actor: owner,
    repository: { id: 1236279848 },
    head_repository: { id: 1236279848 },
    ...overrides,
  };
}

function sourceJobs(tag = "v01.02.05") {
  const item = record(tag);
  return {
    total_count: item.source.jobs.length,
    jobs: item.source.jobs.map((job) => ({
      id: job.id,
      name: job.name,
      status: "completed",
      conclusion: job.conclusion,
      head_sha: item.tagSha,
      steps: job.requiredSteps.map((name, index) => ({
        number: index + 1,
        name,
        status: "completed",
        conclusion: job.stepConclusions?.[name] ?? "success",
      })),
    })),
  };
}

function artifactSet(tag = "v01.02.05", overrides = {}) {
  const item = record(tag);
  return {
    total_count: 1,
    artifacts: [
      {
        id: item.source.artifact.id,
        name: "release-package-tgz",
        size_in_bytes: item.source.artifact.archiveSize,
        expired: false,
        digest: `sha256:${item.source.artifact.archiveSha256}`,
        workflow_run: {
          id: item.source.runId,
          repository_id: 1236279848,
          head_repository_id: 1236279848,
          head_branch: tag,
          head_sha: item.tagSha,
        },
        ...overrides,
      },
    ],
  };
}

function releaseSnapshot(tag = "v01.02.05", overrides = {}) {
  const item = record(tag);
  return {
    id: item.release.id,
    tag_name: tag,
    target_commitish: item.release.targetCommitish,
    name: item.release.name,
    body: item.release.body,
    draft: true,
    prerelease: false,
    immutable: false,
    author: owner,
    assets: [],
    ...overrides,
  };
}

function releaseAsset(tag = "v01.02.05", id = 486_000_001) {
  const item = record(tag);
  return {
    id,
    name: item.package.tarball,
    state: "uploaded",
    size: item.package.size,
    digest: `sha256:${item.package.sha256}`,
    uploader: owner,
  };
}

describe("historical release recovery manifest", () => {
  it("freezes exact live identities for the recoverable drafts", () => {
    expect(record("v01.02.05")).toMatchObject({
      version: "1.2.5",
      tagSha: "3cf54784d9ccce2c659e554befda91172163c9a7",
      release: { id: 358220705 },
      source: {
        runId: 29945360970,
        artifact: {
          id: 8539912901,
          archiveSha256: "6aeabe0346839288f0a203de258b69bc69bdc5e7c4c1589412cba4474e29a72b",
        },
      },
      package: {
        sha256: "450ddf98bd5f9f3d39414d5641308b144643ed35e5812d3c0f63c1d63f499016",
        sri: "sha512-TlmBgX2b7XEGao77DD/zkBxzIqZuLPTe9MszYzIPY/ZkoUrDGGk+cS9oFqlufVZmQpgdnvlBUzQYj86tJP+k7g==",
      },
    });
    expect(record("v01.02.06")).toMatchObject({
      version: "1.2.6",
      tagSha: "caa1e674be48e24ccb91949364c2845e9aa4e09c",
      release: { id: 358239662 },
      source: {
        runId: 29947725605,
        artifact: {
          id: 8540849394,
          archiveSha256: "06e63925a55e046bfbb9537422bbaad3e6b926f8842f3f3a33e59c25513496e1",
        },
      },
      package: {
        sha256: "65feee59fe7a6fe1352d52e70d01d1b421f9538c033f5adf7342d427edb7e241",
        sri: "sha512-eAPYyiK+alMQ24R4ZsAPrVU8HgaDYltCCADFnqmuOBF8F2GN8PCwvsIZ8K6oDXsu7yBtFEVP0O+wYBg6w1gFHA==",
      },
    });
  });

  it("fails closed for v01.02.04 because two drafts have no authoritative run binding", () => {
    const ambiguous = record("v01.02.04");
    expect(ambiguous.recoverable).toBe(false);
    expect(ambiguous.candidateReleaseIds).toEqual([358159754, 358213427]);
    expect(ambiguous.candidateSources.map(({ runId }) => runId)).toEqual([
      29937668007, 29944483777,
    ]);
    expect(() => assertRecoverableRecord(ambiguous)).toThrow(/authoritative.*run.*draft/i);
  });
});

describe("dispatch and historical evidence validation", () => {
  it("requires the sole operator, main workflow SHA, and an exact typed confirmation", () => {
    const item = record();
    const confirmation = expectedConfirmation(item);
    expect(() => validateDispatchContext(dispatchContext(), item, confirmation)).not.toThrow();
    expect(() =>
      validateDispatchContext(dispatchContext({ actorId: "41898282" }), item, confirmation),
    ).toThrow(/actor/i);
    expect(() =>
      validateDispatchContext(dispatchContext({ workflowSha: "0".repeat(40) }), item, confirmation),
    ).toThrow(/workflow sha/i);
    expect(() => validateDispatchContext(dispatchContext(), item, `${confirmation} `)).toThrow(
      /confirmation/i,
    );
  });

  it("validates the exact failed publish run and its prerequisite jobs", () => {
    const item = record();
    expect(() => validateSourceRun(sourceRun(), item)).not.toThrow();
    expect(() => validateSourceRun(sourceRun("v01.02.05", { workflow_id: 1 }), item)).toThrow(
      /workflow/i,
    );
    expect(() =>
      validateSourceRun(sourceRun("v01.02.05", { head_sha: "0".repeat(40) }), item),
    ).toThrow(/head sha/i);
    expect(() => validateSourceJobs(sourceJobs(), item)).not.toThrow();
    const wrongJobs = sourceJobs();
    wrongJobs.jobs[0].conclusion = "failure";
    expect(() => validateSourceJobs(wrongJobs, item)).toThrow(/job.*conclusion/i);
  });

  it("accepts only the one exact, unexpired artifact and archive digest", () => {
    const item = record();
    expect(() => validateArtifactSet(artifactSet(), item)).not.toThrow();
    expect(() =>
      validateArtifactSet(artifactSet("v01.02.05", { digest: `sha256:${"0".repeat(64)}` }), item),
    ).toThrow(/artifact.*digest/i);
    expect(() => validateArtifactSet(artifactSet("v01.02.05", { expired: true }), item)).toThrow(
      /expired/i,
    );
  });

  it("requires owner-enforced immutability and the exact immutable latest release", () => {
    expect(() => validateImmutablePolicy({ enabled: true, enforced_by_owner: true })).not.toThrow();
    expect(() => validateImmutablePolicy({ enabled: true, enforced_by_owner: false })).toThrow(
      /owner/i,
    );
    expect(() =>
      validateLatestRelease({
        id: 358281062,
        tag_name: "v01.02.07",
        draft: false,
        prerelease: false,
        immutable: true,
        author: owner,
        assets: [
          {
            id: 486361797,
            name: "lcv-ideas-software-ultrabrain-mcp-1.2.7.tgz",
            size: 278290,
            state: "uploaded",
            digest: "sha256:f9aefd88a42fcb9fe5cd8a445eefefdd7f26a9d3b60201b0d95f016f8602276f",
            uploader: owner,
          },
        ],
      }),
    ).not.toThrow();
  });

  it("requires a dedicated recovery environment restricted to the main branch", () => {
    const environment = {
      id: 123,
      node_id: "EN_example",
      name: "historical-release-recovery",
      url: "https://api.github.com/repos/LCV-Ideas-Software/ultrabrain-mcp/environments/historical-release-recovery",
      protection_rules: [{ id: 456, node_id: "GA_example", type: "branch_policy" }],
      deployment_branch_policy: {
        protected_branches: false,
        custom_branch_policies: true,
      },
    };
    const branchPolicies = {
      total_count: 1,
      branch_policies: [{ id: 789, node_id: "GBP_example", name: "main", type: "branch" }],
    };
    expect(() => validateRecoveryEnvironment(environment, branchPolicies)).not.toThrow();
    expect(() =>
      validateRecoveryEnvironment(environment, {
        total_count: 1,
        branch_policies: [{ id: 789, node_id: "GBP_example", name: "v*", type: "tag" }],
      }),
    ).toThrow(/main|branch/i);
  });

  it("binds the tag's package metadata to the frozen version", () => {
    const item = record();
    expect(() =>
      validateTaggedPackage({ name: "@lcv-ideas-software/ultrabrain-mcp", version: "1.2.5" }, item),
    ).not.toThrow();
    expect(() =>
      validateTaggedPackage({ name: "@lcv-ideas-software/ultrabrain-mcp", version: "1.2.6" }, item),
    ).toThrow(/version/i);
  });
});

describe("exact release-id reconciliation", () => {
  it("rejects zero, duplicate, or different matching release ids", () => {
    const item = record();
    const exact = releaseSnapshot();
    expect(validateReleaseList([[exact]], item).id).toBe(358220705);
    expect(() => validateReleaseList([[]], item)).toThrow(/exactly one/i);
    expect(() => validateReleaseList([[exact, { ...exact, id: 358220706 }]], item)).toThrow(
      /exactly one/i,
    );
    expect(() => validateReleaseList([[{ ...exact, id: 358220706 }]], item)).toThrow(/release id/i);
  });

  it("allows an empty draft or the one exact staged asset, and nothing else", () => {
    const item = record();
    expect(validateReleaseSnapshot(releaseSnapshot(), item, "preflight")).toBe("");
    const asset = releaseAsset();
    expect(
      validateReleaseSnapshot(releaseSnapshot("v01.02.05", { assets: [asset] }), item, "staged"),
    ).toBe(String(asset.id));
    expect(() =>
      validateReleaseSnapshot(
        releaseSnapshot("v01.02.05", {
          assets: [asset, { ...asset, id: asset.id + 1, name: "unexpected.tgz" }],
        }),
        item,
        "staged",
      ),
    ).toThrow(/exactly one asset/i);
  });

  it("accepts success only when the exact release is immutable and keeps the same asset id", () => {
    const item = record();
    const asset = releaseAsset();
    expect(
      validateReleaseSnapshot(
        releaseSnapshot("v01.02.05", {
          draft: false,
          immutable: true,
          assets: [asset],
        }),
        item,
        "final",
        String(asset.id),
      ),
    ).toBe(String(asset.id));
    expect(() =>
      validateReleaseSnapshot(
        releaseSnapshot("v01.02.05", {
          draft: false,
          immutable: false,
          assets: [asset],
        }),
        item,
        "final",
        String(asset.id),
      ),
    ).toThrow(/immutable/i);
  });

  it("validates every published field while waiting for GitHub immutability", () => {
    const item = record();
    const asset = releaseAsset();
    expect(
      validateReleaseSnapshot(
        releaseSnapshot("v01.02.05", {
          draft: false,
          immutable: false,
          assets: [asset],
        }),
        item,
        "published-pending",
        String(asset.id),
      ),
    ).toBe(String(asset.id));
    expect(() =>
      validateReleaseSnapshot(
        releaseSnapshot("v01.02.05", {
          name: "tampered",
          draft: false,
          immutable: false,
          assets: [asset],
        }),
        item,
        "published-pending",
        String(asset.id),
      ),
    ).toThrow(/name/i);
  });

  it("uploads only exact bytes to the exact release-id endpoint without redirecting", async () => {
    const bytes = Buffer.from("immutable recovery fixture");
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    const sri = `sha512-${createHash("sha512").update(bytes).digest("base64")}`;
    const item = {
      recoverable: true,
      tag: "v99.99.99",
      release: { id: 42 },
      package: { tarball: "fixture.tgz", size: bytes.length, sha256, sri },
    };
    const directory = mkdtempSync(join(tmpdir(), "ultra-release-upload-test-"));
    const assetPath = join(directory, "fixture.tgz");
    writeFileSync(assetPath, bytes);
    let requestUrl = "";
    let requestOptions:
      | {
          body?: Buffer;
          headers?: Record<string, string>;
          method?: string;
          redirect?: string;
        }
      | undefined;
    try {
      const result = await uploadReleaseAsset({
        item,
        assetPath,
        token: "test-only-token",
        fetchImpl: async (url, options) => {
          requestUrl = String(url);
          requestOptions = options;
          return {
            status: 201,
            text: async () =>
              JSON.stringify({
                id: 77,
                name: "fixture.tgz",
                state: "uploaded",
                size: bytes.length,
                digest: `sha256:${sha256}`,
                uploader: owner,
              }),
          };
        },
      });
      expect(result.id).toBe(77);
      expect(requestUrl).toBe(
        "https://uploads.github.com/repos/LCV-Ideas-Software/ultrabrain-mcp/releases/42/assets?name=fixture.tgz",
      );
      expect(requestOptions).toMatchObject({ method: "POST", redirect: "error" });
      expect(requestOptions?.headers?.Authorization).toBe("Bearer test-only-token");
      expect(Buffer.compare(requestOptions?.body ?? Buffer.alloc(0), bytes)).toBe(0);
    } finally {
      unlinkSync(assetPath);
      rmdirSync(directory);
    }
  });
});

describe("recovery workflow safety contract", () => {
  it("retains total permissions, SHA pins, serialization, and main-only operator guards", () => {
    expect(workflow.match(/^permissions: write-all$/gm)).toHaveLength(1);
    expect(workflow.match(/^ {4}permissions: write-all$/gm)).toHaveLength(2);
    expect(workflow).toContain("queue: max");
    expect(workflow).toContain("github.actor_id == '268063598'");
    expect(workflow).toContain("github.ref == 'refs/heads/main'");
    expect(workflow).toContain("github.workflow_sha == github.sha");
    expect(workflow).toContain("environment: historical-release-recovery");
    expect(workflow).not.toContain("environment: github-release-production");
    expect(workflow).toContain("environments/historical-release-recovery");
    expect(workflow).toContain(
      "environments/historical-release-recovery/deployment-branch-policies",
    );
    for (const match of workflow.matchAll(/uses:\s*([^\s#]+)/g)) {
      expect(match[1]).toMatch(/^[^@\s]+@[0-9a-f]{40}$/);
    }
  });

  it("uses only exact-id artifact and release endpoints with a non-latest patch", () => {
    expect(workflow).toContain(`actions/runs/\${source_run_id}/artifacts?per_page=100`);
    expect(workflow).toContain(`actions/artifacts/\${artifact_id}`);
    expect(workflow).toContain(`actions/artifacts/\${artifact_id}/zip`);
    expect(workflow).toContain(`releases/\${release_id}`);
    expect(workflow).toContain(`releases/assets/\${validated_asset_id}`);
    expect(workflow).toContain('make_latest: "false"');
    expect(workflow).not.toMatch(/(?:DELETE|release delete|releases\/tags)/);
    expect(workflow).not.toMatch(/npm publish|dist-tag add|gh release (?:edit|upload|create)/);
  });

  it("removes exported secrets before subprocesses and revalidates before mutation", () => {
    const recoveryStep = workflow.indexOf("Recover the exact historical draft");
    const unsetSecrets = workflow.indexOf(
      "unset RECOVERY_GITHUB_TOKEN ADMIN_GH_TOKEN",
      recoveryStep,
    );
    const firstApi = workflow.indexOf("github_api", recoveryStep);
    const upload = workflow.indexOf("upload-asset", recoveryStep);
    const prePatchRevalidation = workflow.indexOf("pre-publish-revalidation", upload);
    const patch = workflow.indexOf("--method PATCH", prePatchRevalidation);
    expect(recoveryStep).toBeGreaterThan(-1);
    expect(unsetSecrets).toBeGreaterThan(recoveryStep);
    expect(firstApi).toBeGreaterThan(unsetSecrets);
    expect(upload).toBeGreaterThan(firstApi);
    expect(prePatchRevalidation).toBeGreaterThan(upload);
    expect(patch).toBeGreaterThan(prePatchRevalidation);
  });

  it("makes the trusted main and tag identity the final gate before publication", () => {
    const patch = workflow.indexOf("--method PATCH");
    const boundary = workflow.lastIndexOf("validate_tag_and_main final-publish-boundary", patch);
    const boundaryPrefix = workflow.slice(0, boundary);
    const boundaryToPatch = workflow.slice(boundary, patch);
    expect(boundary).toBeGreaterThan(workflow.indexOf("pre-publish-revalidation"));
    expect(boundaryPrefix.lastIndexOf("validate_policy final-publish-boundary")).toBeGreaterThan(
      workflow.indexOf("pre-publish-revalidation"),
    );
    expect(boundaryPrefix.lastIndexOf("validate_latest final-publish-boundary")).toBeGreaterThan(
      workflow.indexOf("pre-publish-revalidation"),
    );
    expect(
      boundaryPrefix.lastIndexOf(
        'load_exact_release final-publish-boundary "$staged_release_json"',
      ),
    ).toBeGreaterThan(workflow.indexOf("pre-publish-revalidation"));
    expect(
      boundaryPrefix.lastIndexOf("verify_release_asset_bytes final-publish-boundary"),
    ).toBeGreaterThan(workflow.indexOf("pre-publish-revalidation"));
    expect(boundaryToPatch).not.toMatch(/\b(?:git|gh|jq|node|npm)\b/);
  });

  it("verifies both registries, release bytes, and signed immutable attestations", () => {
    expect(workflow).toContain("npm.pkg.github.com");
    expect(workflow).toContain("registry.npmjs.org");
    expect(workflow.match(/^\s+verify_registry_integrity [^()]+$/gm)).toHaveLength(3);
    expect(workflow).toContain("verify-file-sri");
    expect(workflow).toContain('github_release verify "$recovery_tag"');
    expect(workflow).toContain('github_release verify-asset "$recovery_tag"');
    expect(workflow).toContain("assert-safe-gh-release-verifier");
  });
});
