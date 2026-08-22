import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseDocument } from "yaml";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const expectedNpmCliVersion = "12.0.2";
const expectedNpmCliSha512 =
  "b885e890b9418fa1693544d05f53e64f9a73ec194837d4258b15fecdd692347b1dd2a517b1b0cbaf9d31cd8e92c3b70956bd2ecc72833a57b4b3098f5bfa7943";
const expectedNpmCliVersionExpression = "$" + "{{ env.NPM_CLI_VERSION }}";
const expectedNpmCliSha512Expression = "$" + "{{ env.NPM_CLI_SHA512 }}";
const ciWorkflow = read(".github/workflows/ci.yml");
const formatWorkflow = read(".github/workflows/format-public.yml");
const autoTagWorkflow = read(".github/workflows/auto-tag.yml");
const publishWorkflow = read(".github/workflows/publish.yml");
const npmToolchainAction = read(".github/actions/setup-npm-toolchain/action.yml");
const packageJson = JSON.parse(read("package.json"));
const packageLock = JSON.parse(read("package-lock.json"));

const sameRepositoryToolchainAction = "$/.github/actions/setup-npm-toolchain";
const legacyWorkspaceToolchainAction = "./.github/actions/setup-npm-toolchain";
const maxWorkflowAliasCount = 100;

function workflowDiagnostic(error) {
  const code = error?.code ? `${error.code}: ` : "";
  return `${code}${error?.message ?? String(error)}`;
}

function assertNoYamlMergeKeys(value, label, seen = new Set()) {
  if (value === null || typeof value !== "object" || seen.has(value)) return;
  seen.add(value);

  if (value instanceof Map) {
    assert.equal(value.has("<<"), false, `${label} must not use YAML merge keys`);
    for (const child of value.values()) assertNoYamlMergeKeys(child, label, seen);
    return;
  }

  if (Array.isArray(value)) {
    for (const child of value) assertNoYamlMergeKeys(child, label, seen);
  }
}

function parseWorkflowForToolchainAudit(workflow, label) {
  let document;
  try {
    document = parseDocument(workflow, {
      version: "1.2",
      schema: "core",
      strict: true,
      stringKeys: true,
      uniqueKeys: true,
      merge: false,
      resolveKnownTags: false,
    });
  } catch (error) {
    assert.fail(`${label} must be valid YAML: ${workflowDiagnostic(error)}`);
  }

  const diagnostics = [...document.errors, ...document.warnings];
  assert.equal(
    diagnostics.length,
    0,
    `${label} must be valid, unambiguous YAML: ${diagnostics.map(workflowDiagnostic).join("; ")}`,
  );

  let parsed;
  try {
    parsed = document.toJS({ mapAsMap: true, maxAliasCount: maxWorkflowAliasCount });
  } catch (error) {
    assert.fail(`${label} must have bounded YAML aliases: ${workflowDiagnostic(error)}`);
  }

  assert.ok(parsed instanceof Map, `${label} must define a YAML mapping`);
  assertNoYamlMergeKeys(parsed, label);
  return parsed;
}

function assertNoToolchainPinShadow(mapping, label) {
  if (mapping === undefined) return;
  assert.ok(mapping instanceof Map, `${label} env must be a mapping`);
  for (const pin of ["NPM_CLI_VERSION", "NPM_CLI_SHA512"]) {
    assert.equal(mapping.has(pin), false, `${label} must not shadow ${pin}`);
  }
}

function containsExecutableNpmInvocation(script) {
  if (typeof script !== "string") return false;
  return script.split(/\r?\n/).some((line) => {
    const executable = line.trim();
    if (!executable || executable.startsWith("#")) return false;
    return /(^|[\s;&|($"'])npm(?:\.cmd)?(?=\s|$)/.test(executable);
  });
}

function assertExecutableLineOrder(script, expectedLines, label) {
  assert.equal(typeof script, "string", `${label} run must be a string`);
  const executableLines = script
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));

  let previousIndex = -1;
  for (const expectedLine of expectedLines) {
    const index = executableLines.indexOf(expectedLine, previousIndex + 1);
    assert.notEqual(index, -1, `${label} must execute in order: ${expectedLine}`);
    previousIndex = index;
  }
}

function assertNpmToolchainAction(action, label) {
  const parsed = parseWorkflowForToolchainAudit(action, label);
  const runs = parsed.get("runs");
  assert.ok(runs instanceof Map, `${label} must define runs`);
  assert.equal(runs.get("using"), "composite", `${label} must remain a composite action`);

  const steps = runs.get("steps");
  assert.ok(Array.isArray(steps), `${label} must define steps`);
  assert.equal(steps.length, 2, `${label} must define exactly one Unix and one Windows bootstrap`);

  const unix = steps.find(
    (step) => step instanceof Map && step.get("if") === "runner.os != 'Windows'",
  );
  const windows = steps.find(
    (step) => step instanceof Map && step.get("if") === "runner.os == 'Windows'",
  );
  assert.ok(unix instanceof Map, `${label} must define the Unix bootstrap`);
  assert.ok(windows instanceof Map, `${label} must define the Windows bootstrap`);
  assert.equal(unix.get("shell"), "bash", `${label} Unix bootstrap must use bash`);
  assert.equal(windows.get("shell"), "pwsh", `${label} Windows bootstrap must use pwsh`);

  for (const [step, platform] of [
    [unix, "Unix"],
    [windows, "Windows"],
  ]) {
    const env = step.get("env");
    assert.ok(env instanceof Map, `${label} ${platform} bootstrap must define env`);
    assert.deepEqual(
      [...env.keys()].sort(),
      ["NPM_CLI_SHA512", "NPM_CLI_VERSION"],
      `${label} ${platform} bootstrap must receive only the audited pins`,
    );
    assert.equal(
      env.get("NPM_CLI_VERSION"),
      "$" + "{{ inputs.version }}",
      `${label} ${platform} bootstrap must use the version input`,
    );
    assert.equal(
      env.get("NPM_CLI_SHA512"),
      "$" + "{{ inputs.sha512 }}",
      `${label} ${platform} bootstrap must use the SHA-512 input`,
    );
  }

  assertExecutableLineOrder(
    unix.get("run"),
    [
      "set -euo pipefail",
      'printf \'%s  %s\\n\' "$NPM_CLI_SHA512" "$archive" | sha512sum --check --strict',
      'tar -xzf "$archive" -C "$toolchain_dir"',
      'actual_version="$(node "$npm_cli" --version)"',
    ],
    `${label} Unix bootstrap`,
  );
  assertExecutableLineOrder(
    windows.get("run"),
    [
      "$actualSha512 = (Get-FileHash -LiteralPath $archive -Algorithm SHA512).Hash.ToLowerInvariant()",
      "if ($actualSha512 -cne $env:NPM_CLI_SHA512) {",
      'throw "npm CLI SHA-512 verification failed."',
      "& tar.exe -xzf $archive -C $toolchainDir",
      "$actualVersion = (& node $npmCli --version).Trim()",
    ],
    `${label} Windows bootstrap`,
  );
}

function assertExactToolchainJobs(workflow, label) {
  const parsed = parseWorkflowForToolchainAudit(workflow, label);
  const jobs = parsed.get("jobs");
  assert.ok(jobs instanceof Map, `${label} must define a jobs mapping`);

  const requiredJobIds = ["gate", "publish-npmjs", "verify-npmjs", "publish-gh-packages"];
  const exemptJobIds = ["github-release"];
  assert.deepEqual(
    [...jobs.keys()].sort(),
    [...requiredJobIds, ...exemptJobIds].sort(),
    `${label} must classify every job as toolchain-required or exempt`,
  );

  const workflowEnv = parsed.get("env");
  assert.ok(workflowEnv instanceof Map, `${label} must define a workflow env mapping`);
  assert.equal(
    workflowEnv.get("NPM_CLI_VERSION"),
    expectedNpmCliVersion,
    `${label} must pin the audited npm CLI version semantically`,
  );
  assert.equal(
    workflowEnv.get("NPM_CLI_SHA512"),
    expectedNpmCliSha512,
    `${label} must pin the audited npm tarball digest semantically`,
  );

  for (const [jobId, job] of jobs) {
    assert.equal(typeof jobId, "string", `${label} job identifiers must be strings`);
    assert.ok(job instanceof Map, `${label} job ${jobId} must be a mapping`);
    const steps = job.get("steps");
    assert.ok(Array.isArray(steps), `${label} job ${jobId} steps must be a sequence`);

    const toolchainSteps = [];
    const npmInvocationStepIndexes = [];
    for (const [index, step] of steps.entries()) {
      assert.ok(step instanceof Map, `${label} job ${jobId} step ${index} must be a mapping`);
      if (containsExecutableNpmInvocation(step.get("run"))) npmInvocationStepIndexes.push(index);
      if (!step.has("uses")) continue;
      const uses = step.get("uses");
      assert.equal(
        typeof uses,
        "string",
        `${label} job ${jobId} step ${index} uses must be a string`,
      );
      assert.notEqual(
        uses,
        legacyWorkspaceToolchainAction,
        `${label} job ${jobId} step ${index} must not use the legacy workspace-relative action`,
      );
      if (uses === sameRepositoryToolchainAction) toolchainSteps.push({ index, step });
    }

    if (requiredJobIds.includes(jobId)) {
      assert.equal(
        toolchainSteps.length,
        1,
        `${label} job ${jobId} must activate the hash-verified npm toolchain exactly once`,
      );
      assert.equal(
        job.has("if"),
        false,
        `${label} job ${jobId} must not be conditionally disabled`,
      );
      assert.equal(
        job.has("continue-on-error"),
        false,
        `${label} job ${jobId} must not ignore failures`,
      );
      assertNoToolchainPinShadow(job.get("env"), `${label} job ${jobId}`);

      const [{ index: toolchainStepIndex, step: toolchainStep }] = toolchainSteps;
      assert.ok(
        npmInvocationStepIndexes.length > 0,
        `${label} job ${jobId} must execute at least one npm CLI command`,
      );
      assert.ok(
        toolchainStepIndex < Math.min(...npmInvocationStepIndexes),
        `${label} job ${jobId} must activate the hash-verified npm toolchain before its first npm CLI command`,
      );
      assert.equal(
        toolchainStep.has("if"),
        false,
        `${label} job ${jobId} toolchain step must not be conditionally disabled`,
      );
      assert.equal(
        toolchainStep.has("continue-on-error"),
        false,
        `${label} job ${jobId} toolchain step must not ignore failures`,
      );
      assertNoToolchainPinShadow(toolchainStep.get("env"), `${label} job ${jobId} toolchain step`);

      const inputs = toolchainStep.get("with");
      assert.ok(inputs instanceof Map, `${label} job ${jobId} toolchain step must define inputs`);
      assert.deepEqual(
        [...inputs.keys()].sort(),
        ["sha512", "version"],
        `${label} job ${jobId} toolchain step must define only the audited inputs`,
      );
      assert.equal(
        inputs.get("version"),
        expectedNpmCliVersionExpression,
        `${label} job ${jobId} version input must reference the workflow pin`,
      );
      assert.equal(
        inputs.get("sha512"),
        expectedNpmCliSha512Expression,
        `${label} job ${jobId} SHA-512 input must reference the workflow pin`,
      );
    } else {
      assert.equal(
        toolchainSteps.length,
        0,
        `${label} exempt job ${jobId} must not activate the npm toolchain`,
      );
    }
  }
}

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

assertExactToolchainJobs(publishWorkflow, "publication");
const toolchainTextWithoutExecution = publishWorkflow.replaceAll(
  `uses: ${sameRepositoryToolchainAction}`,
  `run: "echo uses: ${sameRepositoryToolchainAction}"`,
);
assert.throws(
  () => assertExactToolchainJobs(toolchainTextWithoutExecution, "non-executable toolchain fixture"),
  /must activate the hash-verified npm toolchain exactly once/,
  "toolchain text outside steps[*].uses must not satisfy the publication contract",
);
const legacyToolchainFixture = publishWorkflow.replace(
  sameRepositoryToolchainAction,
  `"${legacyWorkspaceToolchainAction}"`,
);
assert.throws(
  () => assertExactToolchainJobs(legacyToolchainFixture, "legacy toolchain fixture"),
  /must not use the legacy workspace-relative action/,
  "workspace-relative local actions must remain rejected after actions-lock onboarding",
);

const exactToolchainStepFixture = `      - uses: ${sameRepositoryToolchainAction}
        with:
          version: ${expectedNpmCliVersionExpression}
          sha512: ${expectedNpmCliSha512Expression}`;
const redistributedToolchainFixture = `env:
  NPM_CLI_VERSION: "${expectedNpmCliVersion}"
  NPM_CLI_SHA512: "${expectedNpmCliSha512}"
jobs:
  publish-npmjs:
    steps: []
  gate:
    steps:
${exactToolchainStepFixture}
${exactToolchainStepFixture}
  verify-npmjs:
    steps:
${exactToolchainStepFixture}
  publish-gh-packages:
    steps:
${exactToolchainStepFixture}
  github-release:
    steps: []
`;
assert.throws(
  () => assertExactToolchainJobs(redistributedToolchainFixture, "redistributed fixture"),
  /job publish-npmjs must activate the hash-verified npm toolchain exactly once/,
  "two toolchain calls in one job must not compensate for a missing required job",
);

const lateToolchainFixture = `env:
  NPM_CLI_VERSION: "${expectedNpmCliVersion}"
  NPM_CLI_SHA512: "${expectedNpmCliSha512}"
jobs:
  gate:
    steps:
      - run: npm pack --dry-run
${exactToolchainStepFixture}
  publish-npmjs:
    steps:
${exactToolchainStepFixture}
      - run: npm publish
  verify-npmjs:
    steps:
${exactToolchainStepFixture}
      - run: npm view example version
  publish-gh-packages:
    steps:
${exactToolchainStepFixture}
      - run: npm publish
  github-release:
    steps: []
`;
assert.throws(
  () => assertExactToolchainJobs(lateToolchainFixture, "late toolchain fixture"),
  /must activate the hash-verified npm toolchain before its first npm CLI command/,
  "a toolchain step after an npm command must not satisfy the publication contract",
);

const duplicateUsesFixture = publishWorkflow.replace(
  `        uses: ${sameRepositoryToolchainAction}`,
  `        uses: ${sameRepositoryToolchainAction}\n        uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1`,
);
assert.throws(
  () => assertExactToolchainJobs(duplicateUsesFixture, "duplicate uses fixture"),
  /DUPLICATE_KEY/,
  "ambiguous YAML with duplicate uses keys must fail closed",
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

assertNpmToolchainAction(npmToolchainAction, "hash-verified npm toolchain action");
const inertUnixDigestFixture = npmToolchainAction.replace(
  'printf \'%s  %s\\n\' "$NPM_CLI_SHA512" "$archive" | sha512sum --check --strict',
  'true # printf \'%s  %s\\n\' "$NPM_CLI_SHA512" "$archive" | sha512sum --check --strict',
);
assert.throws(
  () => assertNpmToolchainAction(inertUnixDigestFixture, "inert Unix digest fixture"),
  /must execute in order: printf/,
  "Unix SHA-512 verification text in an inert comment must not satisfy the action contract",
);
const inertWindowsDigestFixture = npmToolchainAction.replace(
  "$actualSha512 = (Get-FileHash -LiteralPath $archive -Algorithm SHA512).Hash.ToLowerInvariant()",
  'Write-Output "Get-FileHash -LiteralPath $archive -Algorithm SHA512"',
);
assert.throws(
  () => assertNpmToolchainAction(inertWindowsDigestFixture, "inert Windows digest fixture"),
  /must execute in order: \$actualSha512/,
  "Windows SHA-512 verification text without a digest computation must not satisfy the action contract",
);

assert.match(
  npmToolchainAction,
  /registry_url="https:\/\/registry\.npmjs\.org\/npm\/-\/npm-\$NPM_CLI_VERSION\.tgz"/,
  "the Unix bootstrap must fetch the exact npm registry tarball",
);
assert.doesNotMatch(
  npmToolchainAction,
  /npm[^\n]*install/,
  "the npm bootstrap must not recursively install executable tooling",
);

console.log("npm publication security regression: PASS");
