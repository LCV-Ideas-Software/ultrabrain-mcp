import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const autoTag = readFileSync(new URL("../.github/workflows/auto-tag.yml", import.meta.url), "utf8");
const publish = readFileSync(new URL("../.github/workflows/publish.yml", import.meta.url), "utf8");

describe("release workflow invariants", () => {
  it("publishes explicit local tarball paths instead of npm git specifications", () => {
    expect(publish.match(/npm publish "\.\/artifacts\/\$PACKAGE_TARBALL"/g)).toHaveLength(2);
    expect(publish).not.toMatch(/npm publish "artifacts\/\$PACKAGE_TARBALL"/);
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

  it("dispatches the workflow from the immutable tag so npm provenance names the source SHA", () => {
    expect(autoTag).toContain('-f ref="$TAG"');
    expect(publish).not.toContain("release_tag:");
  });
});
