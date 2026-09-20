import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const npmExecPath = process.env.npm_execpath;
assert.ok(npmExecPath, "npm_execpath is required to run the published consumer gate");
const registry = "https://registry.npmjs.org/";
const auditAttempts = 3;
const auditRetryDelayMs = 2000;
const tempRoot = await mkdtemp(path.join(os.tmpdir(), "ultrabrain-consumer-"));
const packDirectory = path.join(tempRoot, "pack");
const consumerDirectory = path.join(tempRoot, "consumer");
const blockedInheritedNpmConfig = new Set([
  "npm_config_allow_git",
  "npm_config_allow_remote",
  "npm_config_allow_scripts",
  "npm_config_registry",
]);

function command(commandName, args, options = {}) {
  return execFileSync(commandName, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
    ...options,
  });
}

function npmCommand(args, options = {}) {
  return command(process.execPath, [npmExecPath, ...args], {
    ...options,
    env: cleanEnv(options.env),
  });
}

function cleanEnv(extra = {}) {
  return Object.fromEntries(
    Object.entries({ ...process.env, ...extra }).filter(
      ([key, value]) => value !== undefined && !blockedInheritedNpmConfig.has(key.toLowerCase()),
    ),
  );
}

function parseAuditReport(stdout) {
  if (typeof stdout !== "string" || stdout.trim() === "") {
    return undefined;
  }
  try {
    const report = JSON.parse(stdout);
    return report?.metadata?.vulnerabilities === undefined ? undefined : report;
  } catch {
    return undefined;
  }
}

async function auditReport(cwd) {
  // npm audit exits non-zero both when it finds advisories, where stdout still
  // carries the full report, and when the advisories endpoint is unreachable,
  // where it only carries an error envelope. The first is a real regression; the
  // second is a transient registry failure and must not fail the gate.
  let lastError;
  for (let attempt = 1; attempt <= auditAttempts; attempt += 1) {
    let stdout;
    try {
      stdout = npmCommand(["audit", "--omit=dev", "--json"], { cwd });
    } catch (error) {
      const report = parseAuditReport(error.stdout);
      if (report) {
        return report;
      }
      lastError = error;
      stdout = undefined;
    }
    if (stdout !== undefined) {
      const report = parseAuditReport(stdout);
      if (report) {
        return report;
      }
      lastError = new Error(`npm audit returned an unusable report: ${stdout}`);
    }
    if (attempt < auditAttempts) {
      await new Promise((resolve) => setTimeout(resolve, attempt * auditRetryDelayMs));
    }
  }
  throw lastError;
}

function forbiddenInstalledPackages(lock) {
  const forbidden = ["@hono/node-server", "@modelcontextprotocol/sdk", "hono"];
  return Object.keys(lock.packages ?? {}).filter((packagePath) => {
    const normalized = packagePath.replaceAll("\\", "/");
    return forbidden.some(
      (name) =>
        normalized === `node_modules/${name}` || normalized.endsWith(`/node_modules/${name}`),
    );
  });
}

try {
  await Promise.all([
    mkdir(packDirectory, { recursive: true }),
    mkdir(consumerDirectory, { recursive: true }),
  ]);
  await writeFile(path.join(consumerDirectory, ".npmrc"), `registry=${registry}\n`, "utf8");
  assert.equal(npmCommand(["config", "get", "registry"], { cwd: root }).trim(), registry);
  assert.equal(
    npmCommand(["config", "get", "registry"], { cwd: consumerDirectory }).trim(),
    registry,
  );
  npmCommand(["pack", "--pack-destination", packDirectory, "--ignore-scripts=false"], {
    cwd: root,
  });
  const tarballs = (await readdir(packDirectory)).filter((name) => name.endsWith(".tgz"));
  assert.equal(tarballs.length, 1);
  const tarball = path.join(packDirectory, tarballs[0]);

  await writeFile(
    path.join(consumerDirectory, "package.json"),
    `${JSON.stringify({ name: "consumer-fixture", version: "1.0.0", private: true }, null, 2)}\n`,
    "utf8",
  );
  npmCommand(
    [
      "install",
      "--save-exact",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      "--allow-git=none",
      "--allow-remote=none",
      tarball,
    ],
    { cwd: consumerDirectory },
  );

  const installedRoot = path.join(
    consumerDirectory,
    "node_modules",
    "@lcv-ideas-software",
    "ultrabrain-mcp",
  );
  const installedPackage = JSON.parse(
    await readFile(path.join(installedRoot, "package.json"), "utf8"),
  );
  assert.equal(installedPackage.dependencies?.["@modelcontextprotocol/sdk"], undefined);
  assert.equal(installedPackage.main, "dist/index.js");
  assert.equal(installedPackage.bin?.ultrabrain, "dist/index.js");

  const consumerLock = JSON.parse(
    await readFile(path.join(consumerDirectory, "package-lock.json"), "utf8"),
  );
  assert.deepEqual(forbiddenInstalledPackages(consumerLock), []);

  const audit = await auditReport(consumerDirectory);
  assert.equal(audit.metadata?.vulnerabilities?.total, 0);

  const licenses = await readFile(
    path.join(installedRoot, "dist", "THIRD_PARTY_LICENSES.txt"),
    "utf8",
  );
  const bundledSdkPackage = JSON.parse(
    await readFile(
      path.join(root, "node_modules", "@modelcontextprotocol", "sdk", "package.json"),
      "utf8",
    ),
  );
  assert.equal(bundledSdkPackage.name, "@modelcontextprotocol/sdk");
  assert.match(bundledSdkPackage.version, /^\d+\.\d+\.\d+(?:[-+].+)?$/);
  assert.ok(
    licenses.includes(`${bundledSdkPackage.name}@${bundledSdkPackage.version}`),
    `third-party licenses must identify ${bundledSdkPackage.name}@${bundledSdkPackage.version}`,
  );
  assert.match(licenses, /Permission is hereby granted/);

  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [path.join(installedRoot, "dist", "index.js")],
    cwd: consumerDirectory,
    env: cleanEnv({ ULTRABRAIN_STATE_DIR: path.join(tempRoot, "state") }),
  });
  const client = new Client(
    { name: "fresh-consumer-regression", version: "1.0.0" },
    { capabilities: {} },
  );
  await client.connect(transport);
  try {
    const tools = await client.listTools();
    assert.ok(tools.tools.some((tool) => tool.name === "ultrabrain_start"));
  } finally {
    await client.close();
  }

  console.log("published consumer security regression: PASS");
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}
