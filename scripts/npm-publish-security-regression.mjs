import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const expectedNpmCliVersion = "12.0.2";
const expectedNpmCliSha512 =
  "b885e890b9418fa1693544d05f53e64f9a73ec194837d4258b15fecdd692347b1dd2a517b1b0cbaf9d31cd8e92c3b70956bd2ecc72833a57b4b3098f5bfa7943";
const ciWorkflow = read(".github/workflows/ci.yml");
const formatWorkflow = read(".github/workflows/format-public.yml");
const publishWorkflow = read(".github/workflows/publish.yml");
const npmToolchainAction = read(".github/actions/setup-npm-toolchain/action.yml");
const packageJson = JSON.parse(read("package.json"));
const packageLock = JSON.parse(read("package-lock.json"));

assert.equal(
  packageJson.overrides?.["express-rate-limit"]?.["ip-address"],
  "10.4.0",
  "the MCP SDK rate-limit chain must retain the scoped ip-address 10.4.0 security override",
);
assert.equal(
  packageLock.packages?.["node_modules/ip-address"]?.version,
  "10.4.0",
  "the lockfile must resolve the reviewed ip-address 10.4.0 security override",
);

for (const [workflow, label] of [
  [ciWorkflow, "CI"],
  [formatWorkflow, "public formatting"],
  [publishWorkflow, "publication"],
]) {
  assert.ok(workflow.includes("permissions: write-all"), `${label} must preserve write-all`);
  assert.ok(
    workflow.includes(`NPM_CLI_VERSION: "${expectedNpmCliVersion}"`),
    `${label} must pin the audited npm CLI version`,
  );
  assert.ok(
    workflow.includes(`NPM_CLI_SHA512: "${expectedNpmCliSha512}"`),
    `${label} must pin the audited npm tarball digest`,
  );
  assert.ok(
    workflow.includes("uses: ./.github/actions/setup-npm-toolchain"),
    `${label} must activate the hash-verified npm toolchain`,
  );
}

const gateJob = publishWorkflow.match(/\n {2}gate:[\s\S]*?(?=\n {2}publish-npmjs:)/)?.[0];
assert.ok(gateJob, "publication gate must remain a distinct job");
assert.match(
  gateJob,
  /\n {4}needs: assert-npm-production-boundary/,
  "the publication gate must wait for both npm environment-boundary proofs",
);
assert.doesNotMatch(
  gateJob,
  /\n {4}environment:/,
  "the project-code gate must use the same no-environment OIDC context rejected by the boundary probe",
);

const npmBoundaryJob = publishWorkflow.match(
  /\n {2}assert-npm-environment-boundary:[\s\S]*?(?=\n {2}assert-npm-production-boundary:)/,
)?.[0];
assert.ok(
  npmBoundaryJob,
  "publication must start with a fail-closed npm Trusted Publisher boundary probe",
);
assert.match(
  npmBoundaryJob,
  new RegExp(`PACKAGE_NAME:\\s*["']${packageJson.name.replace("/", "\\/")}["']`),
  "the pre-checkout boundary probe package must match package.json",
);
assert.doesNotMatch(
  npmBoundaryJob,
  /\n\s+(?:uses:|environment:)/,
  "the boundary probe must not checkout code, invoke an action, or enter an environment",
);
assert.match(
  npmBoundaryJob,
  /oidc\/token\/exchange\/package\/\$encoded_package/,
  "the boundary probe must call npm's documented OIDC exchange endpoint",
);
assert.match(
  npmBoundaryJob,
  /\.workflow_ref == \$workflow/,
  "the boundary probe must bind the standard workflow_ref claim for a non-reusable workflow",
);
assert.doesNotMatch(
  npmBoundaryJob,
  /job_workflow_ref/,
  "job_workflow_ref is reserved for reusable workflows and would fail closed incorrectly here",
);
assert.match(
  npmBoundaryJob,
  /401\|404\)[\s\S]*?correctly rejected or concealed[\s\S]*?201\)[\s\S]*?refusing/,
  "only npm's documented identity rejection or concealment may pass; issuance outside npm-production must fail",
);
assert.match(
  npmBoundaryJob,
  /encoded_package="\$\{PACKAGE_NAME\/\\\/\/%2f\}"/,
  "the boundary probe must match npm-package-arg escapedName semantics for scoped packages",
);
for (const transientStatus of ["000", "408", "425", "429"]) {
  assert.ok(
    npmBoundaryJob.includes(`[ "$http_code" = "${transientStatus}" ]`),
    `the boundary probe must retry transient status ${transientStatus} before failing closed`,
  );
}

const npmProductionBoundaryJob = publishWorkflow.match(
  /\n {2}assert-npm-production-boundary:[\s\S]*?(?=\n {2}gate:)/,
)?.[0];
assert.ok(
  npmProductionBoundaryJob,
  "publication must prove the exact authorized npm-production context before executing project code",
);
assert.match(
  npmProductionBoundaryJob,
  /\n {4}needs: assert-npm-environment-boundary/,
  "the authorized-context probe must run only after npm rejects the no-environment context",
);
assert.match(
  npmProductionBoundaryJob,
  /\n {4}environment: npm-production/,
  "the authorized-context probe must enter exactly npm-production",
);
assert.match(
  npmProductionBoundaryJob,
  new RegExp(`PACKAGE_NAME:\\s*["']${packageJson.name.replace("/", "\\/")}["']`),
  "the authorized-context probe package must match package.json",
);
assert.doesNotMatch(
  npmProductionBoundaryJob,
  /\n\s+uses:/,
  "the authorized-context probe must not checkout code or invoke any action",
);
assert.match(
  npmProductionBoundaryJob,
  /oidc\/token\/exchange\/package\/\$encoded_package/,
  "the authorized-context probe must call npm's documented OIDC exchange endpoint",
);
assert.match(
  npmProductionBoundaryJob,
  /encoded_package="\$\{PACKAGE_NAME\/\\\/\/%2f\}"/,
  "the authorized-context probe must match npm-package-arg escapedName semantics for scoped packages",
);
assert.match(
  npmProductionBoundaryJob,
  /\.workflow_ref == \$workflow/,
  "the authorized-context probe must bind the standard workflow_ref claim",
);
assert.match(
  npmProductionBoundaryJob,
  /\.environment == "npm-production"/,
  "the authorized-context probe must bind the exact environment claim",
);
assert.match(
  npmProductionBoundaryJob,
  /\.sub \| endswith\(":environment:npm-production"\)/,
  "the authorized-context probe must bind the exact environment subject suffix",
);
assert.match(
  npmProductionBoundaryJob,
  /201\)[\s\S]*?authorized the exact[\s\S]*?401\)[\s\S]*?refusing/,
  "only credential issuance in npm-production may pass; rejection must fail closed",
);
for (const transientStatus of ["000", "408", "425", "429"]) {
  assert.ok(
    npmProductionBoundaryJob.includes(`[ "$http_code" = "${transientStatus}" ]`),
    `the authorized-context probe must retry transient status ${transientStatus} before failing closed`,
  );
}

const publishJob = publishWorkflow.match(
  /\n {2}publish-npmjs:[\s\S]*?(?=\n {2}verify-npmjs:)/,
)?.[0];
assert.ok(publishJob, "npmjs publication must remain a distinct privileged job");
assert.match(
  publishJob,
  /\n {4}environment:\s*npm-production/,
  "the immutable npm writer must use the protected npm-production environment",
);
assert.doesNotMatch(
  publishJob,
  /\bnpm\s+(?:ci|install|run)\b/,
  "the npm-production job must not install dependencies or execute project lifecycle scripts",
);
assert.match(
  publishJob,
  /npm publish[^\n]*--provenance[^\n]*--ignore-scripts/,
  "the npm writer must publish the immutable tarball with provenance and lifecycle scripts disabled",
);

const verifyJob = publishWorkflow.match(
  /\n {2}verify-npmjs:[\s\S]*?(?=\n {2}publish-gh-packages:)/,
)?.[0];
assert.ok(verifyJob, "npmjs publication must have a blocking post-publication verification job");
assert.match(
  verifyJob,
  /\n {4}needs: \[gate, publish-npmjs\]/,
  "npmjs verification must wait for both the immutable gate and writer",
);
assert.doesNotMatch(
  verifyJob,
  /\n {4}environment:/,
  "post-publication verification must not receive an npm Trusted Publishing environment",
);
assert.match(
  publishWorkflow,
  /\n {2}github-release:[\s\S]*?\n {4}needs: \[gate, verify-npmjs, publish-gh-packages\]/,
  "GitHub Release publication must wait for unprivileged npm verification",
);

assert.match(
  npmToolchainAction,
  /registry_url="https:\/\/registry\.npmjs\.org\/npm\/-\/npm-\$NPM_CLI_VERSION\.tgz"/,
  "the Unix bootstrap must fetch the exact npm registry tarball",
);
assert.match(
  npmToolchainAction,
  /sha512sum --check --strict/,
  "the Unix bootstrap must verify SHA-512 before execution",
);
assert.match(
  npmToolchainAction,
  /Get-FileHash -LiteralPath \$archive -Algorithm SHA512/,
  "the Windows bootstrap must verify SHA-512 before execution",
);
assert.match(
  npmToolchainAction,
  /if: runner\.os == 'Windows'/,
  "the hash-verified bootstrap must support the Windows CI matrix",
);
assert.doesNotMatch(
  npmToolchainAction,
  /npm[^\n]*install/,
  "the npm bootstrap must not recursively install executable tooling",
);

console.log("npm publication security regression: PASS");
