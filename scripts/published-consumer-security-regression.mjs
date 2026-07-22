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
const registry = "https://registry.npmjs.org";
const tempRoot = await mkdtemp(path.join(os.tmpdir(), "ultrabrain-consumer-"));
const packDirectory = path.join(tempRoot, "pack");
const consumerDirectory = path.join(tempRoot, "consumer");
const blockedInheritedNpmConfig = new Set([
  "npm_config_allow_git",
  "npm_config_allow_remote",
  "npm_config_allow_scripts",
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
  npmCommand(["pack", "--pack-destination", packDirectory, "--ignore-scripts=false"], {
    cwd: root,
    env: cleanEnv({ npm_config_registry: registry }),
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
      "--registry",
      registry,
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

  const audit = JSON.parse(
    npmCommand(["audit", "--omit=dev", "--json", "--registry", registry], {
      cwd: consumerDirectory,
    }),
  );
  assert.equal(audit.metadata?.vulnerabilities?.total, 0);

  const licenses = await readFile(
    path.join(installedRoot, "dist", "THIRD_PARTY_LICENSES.txt"),
    "utf8",
  );
  assert.match(licenses, /@modelcontextprotocol\/sdk@1\.29\.0/);
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
