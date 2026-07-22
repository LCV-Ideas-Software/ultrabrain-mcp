import { describe, expect, it } from "vitest";
import {
  assertCanonicalSha512Sri,
  assertGitHubLatest,
  assertRegistryLatest,
  assertSafeGitHubCliReleaseVerifierVersion,
  canonicalSha512Sri,
  compareSemVer,
  decideGitHubLatest,
  decideNpmPublishTag,
  displayTagFromSemVer,
  normalizeNpmViewIntegrity,
  parseSemVer,
  semVerFromDisplayTag,
  validateGitHubReleaseSnapshot,
  verifySha512Sri,
} from "../scripts/release-policy.mjs";

describe("release policy", () => {
  it("parses strict SemVer and rejects ambiguous numeric identifiers", () => {
    expect(parseSemVer("1.2.3-rc.1+build.9").prerelease).toEqual(["rc", "1"]);
    for (const invalid of ["01.2.3", "1.02.3", "1.2.03", "1.2.3-01", "1.2", ""]) {
      expect(() => parseSemVer(invalid)).toThrow(/Invalid SemVer/);
    }
  });

  it("implements SemVer precedence including prerelease identifiers", () => {
    const ordered = [
      "1.0.0-alpha",
      "1.0.0-alpha.1",
      "1.0.0-alpha.beta",
      "1.0.0-beta",
      "1.0.0-beta.2",
      "1.0.0-beta.11",
      "1.0.0-rc.1",
      "1.0.0",
      "1.0.1",
      "1.1.0",
      "2.0.0",
    ];
    for (let index = 1; index < ordered.length; index += 1) {
      expect(compareSemVer(ordered[index - 1], ordered[index])).toBeLessThan(0);
      expect(compareSemVer(ordered[index], ordered[index - 1])).toBeGreaterThan(0);
    }
    expect(compareSemVer("1.2.3+first", "1.2.3+second")).toBe(0);
  });

  it("rejects GitHub CLI releases affected by token disclosure during attestation verification", () => {
    expect(() => assertSafeGitHubCliReleaseVerifierVersion("2.92.0")).toThrow(/2\.93\.0/);
    expect(assertSafeGitHubCliReleaseVerifierVersion("2.93.0")).toBe("2.93.0");
    expect(assertSafeGitHubCliReleaseVerifierVersion("2.96.0")).toBe("2.96.0");
    expect(() => assertSafeGitHubCliReleaseVerifierVersion("not-a-version")).toThrow(/parse/);
  });

  it("normalizes zero-padded display tags without weakening SemVer", () => {
    expect(semVerFromDisplayTag("v01.02.03")).toBe("1.2.3");
    expect(semVerFromDisplayTag("v01.02.03-rc.2")).toBe("1.2.3-rc.2");
    expect(displayTagFromSemVer("1.2.3")).toBe("v01.02.03");
    expect(displayTagFromSemVer("12345678901234567890.2.3-rc.2")).toBe(
      "v12345678901234567890.02.03-rc.2",
    );
    expect(() => displayTagFromSemVer("1.2.3+build.1")).toThrow(/build metadata/);
    expect(() => semVerFromDisplayTag("v01.02.03-01")).toThrow(/Invalid SemVer/);
  });

  it("requires canonical SHA-512 SRI and compares artifact bytes", () => {
    const integrity = canonicalSha512Sri(Buffer.from("immutable tarball"));
    expect(assertCanonicalSha512Sri(integrity)).toHaveLength(64);
    expect(() => assertCanonicalSha512Sri("sha256-deadbeef")).toThrow(/sha512/);
    expect(() => assertCanonicalSha512Sri("sha512-Zm9v")).toThrow(/canonical/);
    expect(() => verifySha512Sri(integrity, canonicalSha512Sri(Buffer.from("different")))).toThrow(
      /does not match/,
    );
    expect(() => verifySha512Sri(integrity, integrity)).not.toThrow();
  });

  it("normalizes npm 12 single-result integrity shapes and rejects ambiguity", () => {
    const integrity = canonicalSha512Sri(Buffer.from("immutable tarball"));
    expect(normalizeNpmViewIntegrity(JSON.stringify(integrity))).toBe(integrity);
    expect(normalizeNpmViewIntegrity(JSON.stringify([integrity]))).toBe(integrity);
    expect(normalizeNpmViewIntegrity(JSON.stringify({ "dist.integrity": integrity }))).toBe(
      integrity,
    );
    expect(() => normalizeNpmViewIntegrity(JSON.stringify([]))).toThrow(/exactly one/);
    expect(() => normalizeNpmViewIntegrity(JSON.stringify([integrity, integrity]))).toThrow(
      /exactly one/,
    );
    expect(() => normalizeNpmViewIntegrity(JSON.stringify(null))).toThrow(/canonical sha512/);
  });

  it("rejects ambiguous or replaced GitHub Release asset snapshots", () => {
    const sha256 = "a".repeat(64);
    const release = {
      id: 123,
      tag_name: "v01.02.05",
      target_commitish: "b".repeat(40),
      assets: [{ id: 456, name: "package.tgz", state: "uploaded", digest: null }],
    };
    const validate = (candidate: Record<string, unknown>, expectedAssetId = "") =>
      validateGitHubReleaseSnapshot({
        release: candidate,
        expectedReleaseId: "123",
        expectedTag: "v01.02.05",
        expectedTarget: "b".repeat(40),
        expectedAssetName: "package.tgz",
        expectedAssetId,
        expectedSha256: sha256,
      });
    expect(validate(release)).toBe("456");
    expect(validate(release, "456")).toBe("456");
    expect(
      validate({ ...release, assets: [{ ...release.assets[0], digest: `sha256:${sha256}` }] }),
    ).toBe("456");
    expect(() => validate({ ...release, assets: [] })).toThrow(/exactly one/);
    expect(() => validate({ ...release, assets: [...release.assets, release.assets[0]] })).toThrow(
      /exactly one/,
    );
    expect(() => validate(release, "999")).toThrow(/asset id changed/);
    expect(() =>
      validate({
        ...release,
        assets: [{ ...release.assets[0], digest: `sha256:${"c".repeat(64)}` }],
      }),
    ).toThrow(/digest does not match/);
  });

  it("selects npm latest only monotonically and never for prereleases", () => {
    expect(decideNpmPublishTag("1.2.3", "latest", "")).toBe("latest");
    expect(decideNpmPublishTag("1.2.3", "latest", "1.2.2")).toBe("latest");
    expect(decideNpmPublishTag("1.2.3", "latest", "1.2.3")).toBe("latest");
    expect(decideNpmPublishTag("1.2.2", "latest", "1.2.3")).toBe("historical");
    expect(decideNpmPublishTag("1.3.0-rc.1", "rc", "1.2.3")).toBe("rc");
    expect(() => decideNpmPublishTag("1.3.0-rc.1", "latest", "1.2.3")).toThrow(/prerelease/);
    expect(() => decideNpmPublishTag("1.3.0", "latest", "1.4.0-rc.1")).toThrow(
      /must never point to prerelease/,
    );
  });

  it("detects registry latest regressions and permits a concurrent advance", () => {
    expect(() =>
      assertRegistryLatest({
        candidateVersion: "1.3.0",
        priorLatest: "1.2.0",
        actualLatest: "1.4.0",
        publishTag: "latest",
      }),
    ).not.toThrow();
    expect(() =>
      assertRegistryLatest({
        candidateVersion: "1.1.0",
        priorLatest: "1.2.0",
        actualLatest: "1.1.0",
        publishTag: "historical",
      }),
    ).toThrow(/regressed/);
    expect(() =>
      assertRegistryLatest({
        candidateVersion: "1.3.0-rc.1",
        priorLatest: "1.2.0",
        actualLatest: "1.3.0-rc.1",
        publishTag: "rc",
      }),
    ).toThrow(/must never point to prerelease/);
  });

  it("applies the same monotonic policy to GitHub latest releases", () => {
    expect(decideGitHubLatest("1.3.0", "v01.02.00")).toBe(true);
    expect(decideGitHubLatest("1.2.0", "v01.03.00")).toBe(false);
    expect(decideGitHubLatest("1.3.0-rc.1", "v01.02.00")).toBe(false);
    expect(() =>
      assertGitHubLatest({
        candidateVersion: "1.3.0",
        priorLatestTag: "v01.02.00",
        actualLatestTag: "v01.04.00",
        promoteLatest: true,
      }),
    ).not.toThrow();
    expect(() =>
      assertGitHubLatest({
        candidateVersion: "1.1.0",
        priorLatestTag: "v01.02.00",
        actualLatestTag: "v01.01.00",
        promoteLatest: false,
      }),
    ).toThrow(/regressed/);
  });
});
