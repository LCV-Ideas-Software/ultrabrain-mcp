import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const expectedNpmCliVersion = "12.0.2";
const expectedNpmCliSha512 =
  "b885e890b9418fa1693544d05f53e64f9a73ec194837d4258b15fecdd692347b1dd2a517b1b0cbaf9d31cd8e92c3b70956bd2ecc72833a57b4b3098f5bfa7943";
const ciWorkflow = read(".github/workflows/ci.yml");
const formatWorkflow = read(".github/workflows/format-public.yml");
const autoTagWorkflow = read(".github/workflows/auto-tag.yml");
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
  [autoTagWorkflow, "auto-tag"],
  [publishWorkflow, "publication"],
]) {
  assert.ok(!workflow.includes("permissions: write-all"), `${label} must not grant write-all`);
}

assert.ok(
  publishWorkflow.includes(`NPM_CLI_VERSION: "${expectedNpmCliVersion}"`),
  "publication must pin the audited npm CLI version",
);
assert.ok(
  publishWorkflow.includes(`NPM_CLI_SHA512: "${expectedNpmCliSha512}"`),
  "publication must pin the audited npm tarball digest",
);
assert.ok(
  publishWorkflow.includes("uses: ./.github/actions/setup-npm-toolchain"),
  "publication must activate the hash-verified npm toolchain",
);

assert.match(ciWorkflow, /^permissions: \{\}$/m, "CI must default the token to no permissions");
assert.match(
  formatWorkflow,
  /^permissions: \{\}$/m,
  "public formatting must default the token to no permissions",
);
assert.match(
  publishWorkflow,
  /^permissions: \{\}$/m,
  "publication must default the token to no permissions",
);
assert.match(
  autoTagWorkflow,
  /^permissions: \{\}$/m,
  "auto-tag must default the token to no permissions",
);
const autoTagJob = autoTagWorkflow.match(/\n {2}auto-tag:[\s\S]*$/)?.[0];
assert.ok(autoTagJob, "auto-tag controller job must exist");
const autoTagPermissions = autoTagJob.match(
  /\n {4}permissions:\n((?: {6}[a-z-]+: (?:read|write)(?: +#.*)?\n)+)/,
)?.[1];
assert.ok(autoTagPermissions, "auto-tag controller must declare scoped permissions");
assert.deepEqual(
  autoTagPermissions
    .trim()
    .split("\n")
    .map((line) => line.replace(/\s+#.*$/, "").trim()),
  ["actions: write", "contents: write"],
  "auto-tag must retain only the permissions required to inspect runs, create a tag and dispatch publication",
);
assert.doesNotMatch(
  autoTagWorkflow,
  /code-scanning\/analyses|application\/sarif\+json/,
  "auto-tag must rely on official workflow conclusions instead of a custom SARIF gate",
);

const publishPermissionContract = new Map([
  ["gate", ["contents: read"]],
  ["publish-npmjs", ["contents: read", "id-token: write"]],
  ["verify-npmjs", ["contents: read"]],
  ["publish-gh-packages", ["contents: read", "id-token: write", "packages: write"]],
  ["github-release", ["contents: write"]],
]);

for (const [jobName, expectedPermissions] of publishPermissionContract) {
  const escapedJobName = jobName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const job = publishWorkflow.match(
    new RegExp(`\\n {2}${escapedJobName}:[\\s\\S]*?(?=\\n {2}[a-z0-9-]+:|$)`),
  )?.[0];
  assert.ok(job, `publication job ${jobName} must exist`);
  const permissions = job.match(
    /\n {4}permissions:\n((?: {6}[a-z-]+: (?:read|write)(?: +#.*)?\n)+)/,
  )?.[1];
  assert.ok(permissions, `publication job ${jobName} must declare scoped permissions`);
  assert.deepEqual(
    permissions
      .trim()
      .split("\n")
      .map((line) => line.replace(/\s+#.*$/, "").trim()),
    expectedPermissions,
    `publication job ${jobName} must retain only its required token permissions`,
  );
}
assert.equal(
  publishWorkflow.match(/\n {4}environment:(?: npm-production|\n {6}name: npm-production)(?:\n|$)/g)
    ?.length ?? 0,
  1,
  "only the official npmjs writer may enter the npm Trusted Publisher environment",
);

const gateJob = publishWorkflow.match(/\n {2}gate:[\s\S]*?(?=\n {2}publish-npmjs:)/)?.[0];
assert.ok(gateJob, "publication gate must remain a distinct job");
assert.doesNotMatch(
  gateJob,
  /\n {4}needs:/,
  "the immutable artifact gate must not depend on a bespoke npm OIDC probe",
);
assert.match(
  gateJob,
  /\n {4}environment:\n {6}name: github-administration\n {6}deployment: false/,
  "the project-code gate must resolve administration authority without creating a deployment",
);
assert.doesNotMatch(
  gateJob,
  /\n {4}environment:\s*npm-production|\n {6}name:\s*npm-production/,
  "the project-code gate must stay outside the npm Trusted Publisher environment",
);

for (const bespokeOidcToken of [
  "assert-npm-environment-boundary",
  "assert-npm-production-boundary",
  "ACTIONS_ID_TOKEN_REQUEST_TOKEN",
  "ACTIONS_ID_TOKEN_REQUEST_URL",
  "oidc/token/exchange",
]) {
  assert.ok(
    !publishWorkflow.includes(bespokeOidcToken),
    `publication must delegate npm OIDC to the official npm client instead of retaining ${bespokeOidcToken}`,
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
  "the npm writer must use the official npm client for OIDC publication with provenance and lifecycle scripts disabled",
);
for (const traditionalCredential of [
  "NODE_AUTH_TOKEN",
  "NPM_TOKEN",
  "NPM_ID_TOKEN",
  "_authToken",
]) {
  assert.ok(
    !publishJob.includes(traditionalCredential),
    `the npmjs writer must authenticate only through npm Trusted Publishing OIDC, not ${traditionalCredential}`,
  );
}
assert.doesNotMatch(
  publishJob,
  /\bsecrets(?:\.|\s*\[)/,
  "the npmjs writer must not receive any repository, organization or environment secret",
);
assert.doesNotMatch(
  publishJob,
  /\bgithub(?:\.token|\s*\[\s*["']token["']\s*\])/,
  "the npmjs writer must not use the implicit GitHub token as an npm credential",
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
const githubPackagesJob = publishWorkflow.match(
  /\n {2}publish-gh-packages:[\s\S]*?(?=\n {2}github-release:)/,
)?.[0];
assert.ok(githubPackagesJob, "GitHub Packages publication must remain a distinct writer job");
assert.match(
  githubPackagesJob,
  /\n {4}needs: \[gate, verify-npmjs\]/,
  "GitHub Packages must wait for npmjs.com to publish and verify so npm authorization cannot create a partial release",
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
