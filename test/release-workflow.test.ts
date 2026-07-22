import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const autoTag = readFileSync(new URL("../.github/workflows/auto-tag.yml", import.meta.url), "utf8");
const publish = readFileSync(new URL("../.github/workflows/publish.yml", import.meta.url), "utf8");

describe("release workflow invariants", () => {
  it("publishes explicit local tarball paths instead of npm git specifications", () => {
    expect(publish.match(/npm publish "\.\/artifacts\/\$PACKAGE_TARBALL"/g)).toHaveLength(2);
    expect(publish).not.toMatch(/npm publish "artifacts\/\$PACKAGE_TARBALL"/);
  });

  it("recovers draft releases by exact release id instead of tag-only CLI lookups", () => {
    expect(publish).toContain("releases?per_page=100");
    expect(publish).toContain("releases/$" + "{release_id}/assets");
    expect(publish).toContain("releases/assets/$" + "{current_asset_id}");
    expect(publish).toContain("releases/$" + "{release_id}");
    expect(publish).not.toContain("releases/tags/$" + "{TAG}");
    expect(publish).not.toMatch(/gh release (?:upload|edit|download)/);
    expect(publish).toContain("release-asset-id");
    expect(publish).not.toContain("release_target=\"$(jq -er '.target_commitish'");
    expect(publish).not.toContain('"$release_json" "$release_id" "$TAG" "$VERIFIED_SHA"');
    expect(publish).not.toContain("target_commitish");
    expect(publish.match(/verify_single_asset "\$validated_asset_id"/g)).toHaveLength(2);
    const prePublishVerification = publish.indexOf('verify_single_asset "$validated_asset_id"');
    const releasePatch = publish.indexOf(
      '"repos/$' + "{GITHUB_REPOSITORY}/releases/$" + '{release_id}"',
    );
    const finalVerification = publish.lastIndexOf('verify_single_asset "$validated_asset_id"');
    expect(prePublishVerification).toBeGreaterThan(-1);
    expect(releasePatch).toBeGreaterThan(prePublishVerification);
    expect(finalVerification).toBeGreaterThan(releasePatch);
    expect(publish).toContain("release_immutable=\"$(jq -er '");
    expect(publish).toContain(
      'if [ "$release_draft" != "true" ] && [ "$release_immutable" != "true" ]',
    );
    expect(publish).toContain('elif [ "$latest_is_reconciled" != "true" ]; then');
    expect(publish).toContain("refusing an unsupported immutable-release mutation");
    expect(publish).not.toContain('latest_payload="$RUNNER_TEMP/latest-release-');
    expect(publish).not.toContain('assert_immutable_release_policy "latest-reconciliation"');
  });

  it("requires owner-enforced immutability and verifies signed release attestations", () => {
    const policyGate = publish.indexOf("Require owner-enforced immutable GitHub Releases");
    const npmPublication = publish.indexOf("Publish immutable artifact to npmjs.com");
    expect(policyGate).toBeGreaterThan(-1);
    expect(npmPublication).toBeGreaterThan(policyGate);
    expect(publish).toContain(`repos/\${GITHUB_REPOSITORY}/immutable-releases`);
    expect(publish).toContain("final_immutable=\"$(jq -er '");
    expect(publish).toContain('has("immutable")');
    expect(publish).toContain("assert-safe-gh-release-verifier");
    expect(publish).toContain('github_release verify "$TAG"');
    expect(publish).toContain('github_release verify-asset "$TAG" "artifacts/$PACKAGE_TARBALL"');
  });

  it("removes administrative tokens from the exported step environment before subprocesses", () => {
    const policyGate = publish.indexOf("Require owner-enforced immutable GitHub Releases");
    const policyUnset = publish.indexOf("unset ADMIN_GH_TOKEN", policyGate);
    const policyApi = publish.indexOf('GH_TOKEN="$admin_gh_token" gh api', policyGate);
    expect(policyUnset).toBeGreaterThan(policyGate);
    expect(policyApi).toBeGreaterThan(policyUnset);

    const releaseStep = publish.indexOf("Revalidate identity and reconcile the GitHub Release");
    const githubTokenCopy = publish.indexOf('github_token="$GH_TOKEN"', releaseStep);
    const githubTokenUnset = publish.indexOf("unset GH_TOKEN", releaseStep);
    const releaseUnset = publish.indexOf("unset IMMUTABILITY_TOKEN", releaseStep);
    const releaseGit = publish.indexOf('git fetch --force origin "refs/tags/$TAG', releaseStep);
    expect(githubTokenCopy).toBeGreaterThan(releaseStep);
    expect(githubTokenUnset).toBeGreaterThan(githubTokenCopy);
    expect(releaseUnset).toBeGreaterThan(releaseStep);
    expect(releaseGit).toBeGreaterThan(githubTokenUnset);
    expect(releaseGit).toBeGreaterThan(releaseUnset);
    expect(publish).toContain('GH_TOKEN="$immutability_token" gh api');
    expect(publish).not.toContain('GH_TOKEN="$IMMUTABILITY_TOKEN" gh api');
    expect(publish).toContain('GH_TOKEN="$github_token" gh api "$@"');
    expect(publish).toContain('GH_TOKEN="$github_token" gh release "$@"');
    expect(publish).toContain("Authorization: Bearer $github_token");
  });

  it("serializes every main candidate and retains automatic recovery triggers", () => {
    expect(autoTag).toContain("group: auto-tag-main");
    expect(autoTag).toContain("queue: max");
    expect(autoTag).toContain('cron: "47 * * * *"');
    expect(autoTag).toContain("target_sha=$target_sha");
    expect(autoTag).toContain("version-introduction target");
  });

  it("keeps release refs authenticated and exact-SHA security evidence blocking", () => {
    expect(autoTag).not.toContain("git ls-remote");
    expect(autoTag).toContain("/git/ref/tags/$" + "{encoded_tag}");
    expect(autoTag).toContain('"Accept: application/sarif+json"');
    expect(autoTag).toContain(".commit_sha == $sha");
    expect(autoTag).not.toContain('.ruleId != "VulnerabilitiesID"');
    expect(autoTag).toContain('.ruleId != "TokenPermissionsID"');
    expect(autoTag).toContain("unexpected result(s)");
  });

  it("never re-runs historical push gates into current-main concurrency groups", () => {
    expect(autoTag).not.toMatch(/actions\/runs\/[^\s"']+\/rerun/);
    expect(autoTag).not.toContain("rerun-failed-jobs");
    expect(autoTag).toContain('.conclusion != "success"');
  });

  it("recognizes digest-less assets only after exact publish proof and byte verification", () => {
    expect(autoTag).toContain("actions/workflows/$" + "{publish_workflow_id}/runs");
    expect(autoTag).toContain(".head_sha == $sha");
    expect(autoTag).toMatch(/npm view "\$\{PACKAGE_NAME\}@\$\{VERSION\}" dist\.integrity/);
    expect(autoTag).toContain("normalize-npm-view-integrity");
    expect(autoTag).toContain("GitHub latest requires reconciliation");
    expect(autoTag).toContain("verify-file-sri");
    expect(autoTag).toContain("gh release download");
  });

  it("dispatches the workflow from the immutable tag so npm provenance names the source SHA", () => {
    expect(autoTag).toContain('-f ref="$TAG"');
    expect(publish).not.toContain("release_tag:");
  });
});
