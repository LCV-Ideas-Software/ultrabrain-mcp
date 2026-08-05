import { TEMPLATES, type UltraBrainEngine } from "./engine.js";
import {
  SERVER_HOMEPAGE,
  SERVER_LICENSE,
  SERVER_NAME,
  SERVER_PUBLISHER,
  SERVER_RELEASE_DATE,
  SERVER_SPONSORS_URL,
  SERVER_VERSION,
} from "./meta.js";
import { MAX_TEXT_LENGTH } from "./normalize.js";

export type PersistenceEnv = "ULTRABRAIN_STATE_DIR" | "ULTRABRAIN_PERSIST_DIR" | null;

/**
 * Select the persistence source with a single trimmed-non-empty rule feeding
 * both the engine and the server_info report, so the advertised
 * config_precedence is honored even for blank env values (a blank var counts
 * as unset and falls through to the next source).
 */
export function resolvePersistence(env: Record<string, string | undefined>): {
  source: PersistenceEnv;
  dir: string | undefined;
} {
  for (const name of ["ULTRABRAIN_STATE_DIR", "ULTRABRAIN_PERSIST_DIR"] as const) {
    const value = env[name]?.trim();
    if (value) {
      return { source: name, dir: value };
    }
  }
  return { source: null, dir: undefined };
}

export interface ServerInfoInputs {
  engine: UltraBrainEngine;
  persistenceEnv: PersistenceEnv;
  tools: string[];
  prompts: string[];
  resources: string[];
  resourceTemplates: string[];
}

/**
 * Build the ultrabrain_server_info payload. The shape mirrors the cross-review
 * server_info tool (identity, release, transport flags, capabilities, tool
 * listing, data_dir, config_load, config_precedence) adapted to ultrabrain's
 * specifics: prompts/resources/templates surface, engine limits, and session
 * persistence instead of peer/model/cost configuration.
 */
export function buildServerInfo(inputs: ServerInfoInputs): Record<string, unknown> {
  const runtime = inputs.engine.runtimeInfo();
  return {
    name: SERVER_NAME,
    publisher: SERVER_PUBLISHER,
    version: SERVER_VERSION,
    release_date: SERVER_RELEASE_DATE,
    homepage: SERVER_HOMEPAGE,
    sponsors_url: SERVER_SPONSORS_URL,
    license: SERVER_LICENSE,
    transport: "stdio",
    // Cross-review's api_only/cli_execution pair describes how peer LLMs are
    // executed (provider API vs CLI subprocess). Ultrabrain executes no external
    // LLMs at all, so both are false and external_calls states it explicitly.
    api_only: false,
    cli_execution: false,
    external_calls: "none",
    stable_release: true,
    capabilities: {
      stable_release: true,
      api_only: false,
      cli_execution: false,
      external_llm_calls: false,
      durable_sessions: runtime.persistence_enabled,
      restart_recovery: runtime.persistence_enabled,
      structured_content: true,
      prompts: true,
      resources: true,
      resource_templates: true,
      related_thoughts: true,
      template_coverage: true,
      mermaid_review: true,
      bias_detection: true,
      quality_scoring: true,
      metrics: true,
    },
    tools: inputs.tools,
    prompts: inputs.prompts,
    resources: inputs.resources,
    resource_templates: inputs.resourceTemplates,
    templates: {
      count: TEMPLATES.length,
      ids: TEMPLATES.map((template) => template.id),
    },
    data_dir: runtime.persistence_dir,
    config_load: {
      source: inputs.persistenceEnv,
      applied: runtime.persistence_enabled,
    },
    config_precedence: [
      "ULTRABRAIN_STATE_DIR",
      "ULTRABRAIN_PERSIST_DIR",
      "hardcoded defaults (in-memory sessions)",
    ],
    sessions: {
      active_count: runtime.active_sessions,
    },
    limits: {
      ...runtime.limits,
      max_text_length: MAX_TEXT_LENGTH,
    },
    reserved_branch_keys: runtime.reserved_branch_keys,
    runtime: {
      node: process.version,
      platform: process.platform,
    },
    security_policy:
      "Local-first reasoning gate: no external LLM or network calls; session data stays on the host. Optional persistence only via ULTRABRAIN_STATE_DIR or ULTRABRAIN_PERSIST_DIR.",
  };
}
