import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const archivedWorkflowUrl = new URL("./fixtures/recover-historical-releases.yml", import.meta.url);
const attestationUrl = new URL("./fixtures/github-release-verify-v01.02.07.json", import.meta.url);
const retiredHelperUrl = new URL("../scripts/historical-release-recovery.mjs", import.meta.url);
const liveWorkflowUrl = new URL(
  "../.github/workflows/recover-historical-releases.yml",
  import.meta.url,
);

function sha256(url: URL): string {
  return createHash("sha256").update(readFileSync(url)).digest("hex");
}

describe("archived historical-release recovery evidence", () => {
  it("pins the immutable archived artifacts", () => {
    expect(sha256(archivedWorkflowUrl)).toBe(
      "2b0f0534c1c5402c061983937a3d5a60fae703f24fbea992c73898fbac308499",
    );
    expect(sha256(attestationUrl)).toBe(
      "a93d026c1ae79acc4a5ddb7102595e79da3cb1bdcc3877b0f0a25203f1ae7d29",
    );
  });

  it("keeps the retired recovery non-executable", () => {
    expect(existsSync(retiredHelperUrl)).toBe(false);
    expect(existsSync(liveWorkflowUrl)).toBe(false);
  });
});
