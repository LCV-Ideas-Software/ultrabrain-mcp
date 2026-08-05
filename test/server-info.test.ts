import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { TEMPLATES, UltraBrainEngine } from "../src/engine.js";
import {
  SERVER_HOMEPAGE,
  SERVER_NAME,
  SERVER_RELEASE_DATE,
  SERVER_SPONSORS_URL,
  SERVER_VERSION,
} from "../src/meta.js";
import { buildServerInfo, resolvePersistence } from "../src/server-info.js";
import { thought } from "./helpers.js";

const SURFACE = {
  tools: ["ultrabrain_start", "ultrabrain_think", "ultrabrain_server_info"],
  prompts: ["ultrabrain_problem_breakdown"],
  resources: ["ultrabrain://sessions"],
  resourceTemplates: ["ultrabrain://session/{session_id}"],
};

let dir: string | undefined;
afterEach(() => {
  if (dir) {
    rmSync(dir, { recursive: true, force: true });
    dir = undefined;
  }
});

describe("resolvePersistence honors the advertised config precedence", () => {
  it("prefers ULTRABRAIN_STATE_DIR when both are set", () => {
    const resolved = resolvePersistence({
      ULTRABRAIN_STATE_DIR: "C:/state",
      ULTRABRAIN_PERSIST_DIR: "C:/persist",
    });
    expect(resolved).toEqual({ source: "ULTRABRAIN_STATE_DIR", dir: "C:/state" });
  });

  it("falls through a blank ULTRABRAIN_STATE_DIR to a valid ULTRABRAIN_PERSIST_DIR", () => {
    const resolved = resolvePersistence({
      ULTRABRAIN_STATE_DIR: "   ",
      ULTRABRAIN_PERSIST_DIR: "C:/persist",
    });
    expect(resolved).toEqual({ source: "ULTRABRAIN_PERSIST_DIR", dir: "C:/persist" });
  });

  it("reports no source when both vars are blank or unset", () => {
    expect(resolvePersistence({ ULTRABRAIN_STATE_DIR: "" })).toEqual({
      source: null,
      dir: undefined,
    });
    expect(resolvePersistence({})).toEqual({ source: null, dir: undefined });
  });

  it("trims surrounding whitespace exactly as the engine constructor always has", () => {
    // The engine constructor has always trimmed persistence_dir before resolving
    // it, so a padded env value never addressed a literal whitespace path in any
    // released version. Trimming here preserves that behavior byte-for-byte.
    const resolved = resolvePersistence({ ULTRABRAIN_STATE_DIR: " C:/state " });
    expect(resolved).toEqual({ source: "ULTRABRAIN_STATE_DIR", dir: "C:/state" });
  });

  it("addresses the same directory the engine resolves for a padded value", () => {
    dir = mkdtempSync(join(tmpdir(), "ub-info-"));
    const padded = new UltraBrainEngine({ persistence_dir: ` ${dir} ` });
    const resolved = resolvePersistence({ ULTRABRAIN_STATE_DIR: ` ${dir} ` });
    const viaResolver = new UltraBrainEngine({ persistence_dir: resolved.dir });
    expect(padded.runtimeInfo().persistence_dir).toBe(viaResolver.runtimeInfo().persistence_dir);
  });
});

describe("engine.runtimeInfo", () => {
  it("reports in-memory mode when persistence is off", () => {
    const engine = new UltraBrainEngine();
    const info = engine.runtimeInfo();
    expect(info.persistence_enabled).toBe(false);
    expect(info.persistence_dir).toBeNull();
    expect(info.active_sessions).toBe(0);
  });

  it("reports the resolved dir and live session count when persistence is on", () => {
    dir = mkdtempSync(join(tmpdir(), "ub-info-"));
    const engine = new UltraBrainEngine({ persistence_dir: dir });
    engine.process(thought({ session_id: "a", thought_number: 1 }));
    engine.process(thought({ session_id: "b", thought_number: 1 }));
    const info = engine.runtimeInfo();
    expect(info.persistence_enabled).toBe(true);
    expect(info.persistence_dir).toContain("ub-info-");
    expect(info.active_sessions).toBe(2);
  });

  it("exposes the engine limits and reserved branch keys", () => {
    const info = new UltraBrainEngine().runtimeInfo();
    expect(info.limits.max_session_thoughts).toBe(300);
    expect(info.limits.max_branch_thoughts).toBe(100);
    expect(info.limits.max_session_id_length).toBe(128);
    expect(info.reserved_branch_keys).toContain("__proto__");
  });
});

describe("buildServerInfo mirrors the cross-review server_info shape", () => {
  it("carries identity, flags, surface listings, and limits", () => {
    const engine = new UltraBrainEngine();
    const info = buildServerInfo({ engine, persistenceEnv: null, ...SURFACE });

    expect(info.name).toBe(SERVER_NAME);
    expect(info.publisher).toBe("LCV Ideas & Software");
    expect(info.version).toBe(SERVER_VERSION);
    expect(info.release_date).toBe(SERVER_RELEASE_DATE);
    expect(info.homepage).toBe(SERVER_HOMEPAGE);
    expect(info.sponsors_url).toBe(SERVER_SPONSORS_URL);
    expect(info.transport).toBe("stdio");
    // A local-only server makes no external calls at all: api_only and
    // cli_execution are both false, stated explicitly by external_calls.
    expect(info.api_only).toBe(false);
    expect(info.cli_execution).toBe(false);
    expect(info.external_calls).toBe("none");
    expect(info.stable_release).toBe(true);
    expect(info.tools).toEqual(SURFACE.tools);
    expect(info.prompts).toEqual(SURFACE.prompts);
    expect(info.resources).toEqual(SURFACE.resources);
    expect(info.resource_templates).toEqual(SURFACE.resourceTemplates);
    expect(info.templates).toEqual({
      count: TEMPLATES.length,
      ids: TEMPLATES.map((template) => template.id),
    });
    expect(info.limits).toMatchObject({
      max_session_thoughts: 300,
      max_branch_thoughts: 100,
      max_session_id_length: 128,
      max_text_length: 20000,
    });
    expect(info.config_precedence).toEqual([
      "ULTRABRAIN_STATE_DIR",
      "ULTRABRAIN_PERSIST_DIR",
      "hardcoded defaults (in-memory sessions)",
    ]);
    expect(typeof info.security_policy).toBe("string");
  });

  it("reports disabled persistence with a null data_dir", () => {
    const engine = new UltraBrainEngine();
    const info = buildServerInfo({ engine, persistenceEnv: null, ...SURFACE });
    expect(info.data_dir).toBeNull();
    expect(info.config_load).toEqual({ source: null, applied: false });
    const capabilities = info.capabilities as Record<string, boolean>;
    expect(capabilities.durable_sessions).toBe(false);
    expect(capabilities.structured_content).toBe(true);
  });

  it("reports the env source and data_dir when persistence is on", () => {
    dir = mkdtempSync(join(tmpdir(), "ub-info-"));
    const engine = new UltraBrainEngine({ persistence_dir: dir });
    engine.process(thought({ session_id: "s", thought_number: 1 }));
    const info = buildServerInfo({
      engine,
      persistenceEnv: "ULTRABRAIN_STATE_DIR",
      ...SURFACE,
    });
    expect(info.data_dir).toContain("ub-info-");
    expect(info.config_load).toEqual({ source: "ULTRABRAIN_STATE_DIR", applied: true });
    expect((info.capabilities as Record<string, boolean>).durable_sessions).toBe(true);
    expect(info.sessions).toEqual({ active_count: 1 });
  });
});
