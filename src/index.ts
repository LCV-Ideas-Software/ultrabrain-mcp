#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  GetPromptRequestSchema,
  ListPromptsRequestSchema,
  ListResourcesRequestSchema,
  ListResourceTemplatesRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { formatResult, TEMPLATES, toJsonPayload, UltraBrainEngine } from "./engine.js";
import {
  normalizeAnalyzeInput,
  normalizeMergeInput,
  normalizeReviewInput,
  normalizeSessionId,
  normalizeStartInput,
  normalizeThoughtInput,
  normalizeUpdateInput,
  normalizeValidateInput,
  readBoolean,
  readNumber,
  readSessionId,
  readString,
} from "./normalize.js";
import type { ResponseFormat, ToolErrorPayload } from "./types.js";

const SERVER_NAME = "ultrabrain-mcp";
const SERVER_VERSION = "1.2.6";

const engine = new UltraBrainEngine({
  persistence_dir: process.env.ULTRABRAIN_STATE_DIR ?? process.env.ULTRABRAIN_PERSIST_DIR,
});

const responseFormatProperty = {
  type: "string",
  enum: ["json", "markdown", "text"],
  description: "Response format.",
};

const sessionIdProperty = {
  type: "string",
  description: 'Optional reasoning session id. Defaults to "default".',
};

const thoughtProperties = {
  session_id: sessionIdProperty,
  response_format: responseFormatProperty,
  thought: {
    type: "string",
    description: "Current Ultrabrain reasoning step.",
  },
  thought_number: {
    type: "number",
    description: "Current thought number in the chain.",
  },
  total_thoughts: {
    type: "number",
    description: "Estimated total thoughts. Adjust this as scope changes.",
  },
  next_thought_needed: {
    type: "boolean",
    description: "Set to false only when this chain has reached a verified conclusion.",
  },
  step_type: {
    type: "string",
    enum: [
      "analysis",
      "hypothesis",
      "verification",
      "conclusion",
      "assumption",
      "counterargument",
      "synthesis",
      "decision",
      "implementation",
      "review",
    ],
    description: "Reasoning step category.",
  },
  mode: {
    type: "string",
    enum: [
      "code",
      "serial",
      "parallel",
      "hybrid",
      "critical",
      "analytical",
      "systematic",
      "creative",
      "metacognitive",
      "strategic",
      "dialectical",
      "first_principles",
      "decision_matrix",
      "root_cause",
      "socratic",
    ],
    description: "Reasoning mode.",
  },
  is_revision: {
    type: "boolean",
    description: "Whether this step revises an earlier thought.",
  },
  revises_thought: {
    type: "number",
    description: "Thought number being revised.",
  },
  branch_from_thought: {
    type: "number",
    description: "Thought number where this branch starts.",
  },
  branch_id: {
    type: "string",
    description: "Branch identifier.",
  },
  parent_thought: {
    type: "number",
    description: "Optional parent thought reference.",
  },
  needs_more_thoughts: {
    type: "boolean",
    description: "Allows thought_number to exceed total_thoughts when scope expands.",
  },
  depth_level: {
    type: "number",
    description: "Current depth for serial reasoning.",
  },
  max_depth: {
    type: "number",
    description: "Maximum planned depth.",
  },
  budget_mode: {
    type: "string",
    enum: ["fast", "balanced", "thorough", "exhaustive"],
    description: "Reasoning budget mode.",
  },
  budget_used: {
    type: "number",
    description: "Budget used percentage from 0 to 100.",
  },
  confidence: {
    type: "number",
    description: "Confidence from 0 to 1.",
  },
  meta_checkpoint: {
    type: "boolean",
    description: "Marks an explicit meta-reasoning checkpoint.",
  },
  bias_detected: {
    type: "string",
    description: "Known cognitive bias to track.",
  },
  quality_metrics: {
    type: "object",
    description: "Quality scores from 0 to 5.",
    properties: {
      logical_consistency: { type: "number" },
      completeness: { type: "number" },
      objectivity: { type: "number" },
      practicality: { type: "number" },
      clarity: { type: "number" },
      depth: { type: "number" },
      breadth: { type: "number" },
      relevance: { type: "number" },
      actionability: { type: "number" },
    },
  },
  evidence: {
    type: "array",
    items: { type: "string" },
    description: "Evidence supporting this thought.",
  },
  assumptions: {
    type: "array",
    items: { type: "string" },
    description: "Assumptions to track.",
  },
  open_questions: {
    type: "array",
    items: { type: "string" },
    description: "Unresolved questions.",
  },
  alternatives: {
    type: "array",
    items: { type: "string" },
    description: "Alternative paths or options.",
  },
  risks: {
    type: "array",
    items: { type: "string" },
    description: "Known risks.",
  },
  next_actions: {
    type: "array",
    items: { type: "string" },
    description: "Concrete next checks or implementation actions.",
  },
  tags: {
    type: "array",
    items: { type: "string" },
    description: "Optional tags.",
  },
  perspective: {
    type: "string",
    description: "Optional perspective, such as reviewer, maintainer, security, UX, or operator.",
  },
  expected_output: {
    type: "string",
    description: "Expected output from the reasoning chain.",
  },
  hypothesis: {
    type: "string",
    description: "Explicit hypothesis for this step.",
  },
  verification: {
    type: "string",
    description: "Verification approach or result.",
  },
};

const tools = [
  {
    name: "ultrabrain_start",
    title: "Ultrabrain Start",
    description:
      "Create a branded LCV Ultrabrain reasoning session and optionally seed the first thought.",
    inputSchema: {
      type: "object",
      properties: {
        session_id: sessionIdProperty,
        problem: { type: "string", description: "Problem or decision to reason about." },
        context: { type: "string", description: "Relevant context." },
        template: {
          type: "string",
          description: "Optional template id from ultrabrain_templates.",
        },
        tags: { type: "array", items: { type: "string" } },
        initial_thought: { type: "string", description: "Optional first thought." },
        total_thoughts: {
          type: "number",
          description: "Estimated total thoughts for the seeded chain.",
        },
        response_format: responseFormatProperty,
      },
      required: ["problem"],
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
  },
  {
    name: "ultrabrain_think",
    title: "Ultrabrain Think",
    description:
      "Canonical LCV reasoning gate for code work, branching, revisions, quality metrics, bias checks, confidence, and meta checkpoints. Protocol: state evidence and assumptions before conclusions; set step_type honestly (analysis, hypothesis, verification, conclusion...); attach evidence[] for any factual claim; branch when a materially different path exists and revise when an earlier step was wrong; adjust total_thoughts when scope changes instead of forcing a fit; only set next_thought_needed to false once a verification step has checked the conclusion. Close each step by asking: what am I missing or need to reconsider?",
    inputSchema: {
      type: "object",
      properties: thoughtProperties,
      required: ["thought", "thought_number", "total_thoughts", "next_thought_needed"],
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
  },
  {
    name: "ultrabrain_update",
    title: "Ultrabrain Update",
    description:
      "Update an existing thought with stronger evidence, confidence, risks, actions, or quality metrics.",
    inputSchema: {
      type: "object",
      properties: {
        session_id: sessionIdProperty,
        thought_number: { type: "number" },
        branch_id: { type: "string" },
        thought: { type: "string" },
        confidence: { type: "number" },
        evidence: { type: "array", items: { type: "string" } },
        assumptions: { type: "array", items: { type: "string" } },
        open_questions: { type: "array", items: { type: "string" } },
        alternatives: { type: "array", items: { type: "string" } },
        risks: { type: "array", items: { type: "string" } },
        next_actions: { type: "array", items: { type: "string" } },
        quality_metrics: thoughtProperties.quality_metrics,
        tags: { type: "array", items: { type: "string" } },
        response_format: responseFormatProperty,
      },
      required: ["thought_number"],
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
      openWorldHint: false,
    },
  },
  {
    name: "ultrabrain_branch",
    title: "Ultrabrain Branch",
    description: "Create or continue an Ultrabrain branch from a prior thought.",
    inputSchema: {
      type: "object",
      properties: thoughtProperties,
      required: [
        "thought",
        "thought_number",
        "total_thoughts",
        "next_thought_needed",
        "branch_from_thought",
        "branch_id",
      ],
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
  },
  {
    name: "ultrabrain_merge",
    title: "Ultrabrain Merge",
    description:
      "Merge one or more branch insights into a synthesis, best-evidence path, or decision note.",
    inputSchema: {
      type: "object",
      properties: {
        session_id: sessionIdProperty,
        branch_ids: { type: "array", items: { type: "string" } },
        strategy: { type: "string", enum: ["synthesis", "best_evidence", "decision"] },
        create_thought: {
          type: "boolean",
          description: "Whether to append the synthesis as a new thought.",
        },
        response_format: responseFormatProperty,
      },
      required: ["branch_ids"],
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
  },
  {
    name: "ultrabrain_validate",
    title: "Ultrabrain Validate",
    description:
      "Check a reasoning session for evidence, alternatives, verification, bias, and closure gaps.",
    inputSchema: {
      type: "object",
      properties: {
        session_id: sessionIdProperty,
        strict: { type: "boolean" },
        response_format: responseFormatProperty,
      },
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  {
    name: "ultrabrain_analyze",
    title: "Ultrabrain Analyze",
    description:
      "Analyze quality, confidence, bias counts, label counts, unresolved questions, and recommendations.",
    inputSchema: {
      type: "object",
      properties: {
        session_id: sessionIdProperty,
        response_format: responseFormatProperty,
      },
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  {
    name: "ultrabrain_review",
    title: "Ultrabrain Review",
    description: "Render a reasoning session as a summary, linear chain, tree, markdown, or JSON.",
    inputSchema: {
      type: "object",
      properties: {
        session_id: sessionIdProperty,
        format: {
          type: "string",
          enum: ["summary", "linear", "tree", "markdown", "json", "mermaid"],
        },
        limit: { type: "number" },
      },
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  {
    name: "ultrabrain_status",
    title: "Ultrabrain Status",
    description: "Return session status, thought count, branches, and latest quality score.",
    inputSchema: {
      type: "object",
      properties: {
        session_id: sessionIdProperty,
      },
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  {
    name: "ultrabrain_history",
    title: "Ultrabrain History",
    description: "Return recent normalized thought records for a session.",
    inputSchema: {
      type: "object",
      properties: {
        session_id: sessionIdProperty,
        limit: { type: "number" },
      },
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  {
    name: "ultrabrain_export",
    title: "Ultrabrain Export",
    description: "Export a session as markdown, text, or JSON.",
    inputSchema: {
      type: "object",
      properties: {
        session_id: sessionIdProperty,
        format: responseFormatProperty,
      },
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  {
    name: "ultrabrain_metrics",
    title: "Ultrabrain Metrics",
    description:
      "Return aggregate session, thought, branch, quality, confidence, bias, mode, and step metrics.",
    inputSchema: {
      type: "object",
      properties: {
        session_id: sessionIdProperty,
      },
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  {
    name: "ultrabrain_templates",
    title: "Ultrabrain Templates",
    description: "List LCV Ultrabrain prompt templates for common engineering reasoning workflows.",
    inputSchema: { type: "object", properties: {} },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  {
    name: "ultrabrain_reset",
    title: "Ultrabrain Reset",
    description: "Reset one Ultrabrain session, or all sessions when all_sessions is true.",
    inputSchema: {
      type: "object",
      properties: {
        session_id: sessionIdProperty,
        all_sessions: { type: "boolean" },
      },
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
];

const prompts = [
  {
    name: "ultrabrain_problem_breakdown",
    title: "Ultrabrain Problem Breakdown",
    description:
      "Break a technical problem into evidence, assumptions, hypotheses, verification, and risks.",
    arguments: [
      { name: "problem", description: "Problem to break down.", required: true },
      { name: "context", description: "Relevant project or runtime context.", required: false },
    ],
  },
  {
    name: "ultrabrain_critical_review",
    title: "Ultrabrain Critical Review",
    description:
      "Review an implementation or decision with counterexamples, residual risk, and verification checks.",
    arguments: [
      {
        name: "subject",
        description: "Implementation, design, or decision to review.",
        required: true,
      },
      { name: "evidence", description: "Known evidence or test results.", required: false },
    ],
  },
  {
    name: "ultrabrain_synthesis",
    title: "Ultrabrain Synthesis",
    description: "Synthesize several branches or findings into a decision and next action list.",
    arguments: [
      { name: "findings", description: "Findings to synthesize.", required: true },
      { name: "goal", description: "Decision goal.", required: false },
    ],
  },
];

const resources = [
  {
    uri: "ultrabrain://sessions",
    name: "Ultrabrain Sessions",
    description: "Current Ultrabrain sessions.",
    mimeType: "application/json",
  },
];

const resourceTemplates = [
  {
    uriTemplate: "ultrabrain://session/{session_id}",
    name: "Ultrabrain Session",
    description: "A specific Ultrabrain session.",
    mimeType: "application/json",
  },
  {
    uriTemplate: "ultrabrain://template/{template_id}",
    name: "Ultrabrain Template",
    description: "A built-in LCV Ultrabrain reasoning template.",
    mimeType: "application/json",
  },
];

const server = new Server(
  {
    name: SERVER_NAME,
    version: SERVER_VERSION,
  },
  {
    capabilities: {
      tools: {},
      prompts: {},
      resources: {},
    },
  },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));
server.setRequestHandler(ListPromptsRequestSchema, async () => ({ prompts }));
server.setRequestHandler(ListResourcesRequestSchema, async () => ({ resources }));
server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => ({ resourceTemplates }));

server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  const prompt = prompts.find((candidate) => candidate.name === request.params.name);
  if (!prompt) {
    throw new McpError(ErrorCode.InvalidParams, `Unknown prompt: ${request.params.name}`);
  }
  const args = request.params.arguments ?? {};
  return {
    description: prompt.description,
    messages: [
      {
        role: "user" as const,
        content: {
          type: "text" as const,
          text: renderPrompt(prompt.name, args),
        },
      },
    ],
  };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => ({
  contents: [
    {
      uri: request.params.uri,
      mimeType: "application/json",
      text: JSON.stringify(engine.resource(request.params.uri), null, 2),
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const name = request.params.name;
  const args = request.params.arguments ?? {};

  try {
    if (name === "ultrabrain_start") {
      return objectResponse(engine.start(normalizeStartInput(args)), readResponseFormat(args));
    }
    if (name === "ultrabrain_think" || name === "ultrabrain_branch") {
      const input = normalizeThoughtInput(args);
      if (name === "ultrabrain_branch" && (!input.branch_id || !input.branch_from_thought)) {
        throw new Error("ultrabrain_branch requires branch_id and branch_from_thought.");
      }
      const result = engine.process(input);
      return {
        ...textResponse(formatResult(result)),
        structuredContent: toJsonPayload(result),
      };
    }
    if (name === "ultrabrain_update") {
      return objectResponse(engine.update(normalizeUpdateInput(args)), readResponseFormat(args));
    }
    if (name === "ultrabrain_merge") {
      const input = normalizeMergeInput(args);
      const result = engine.merge(input);
      return input.response_format === "markdown"
        ? textResponse(formatMergeResult(result))
        : objectResponse(result, input.response_format);
    }
    if (name === "ultrabrain_validate") {
      const input = normalizeValidateInput(args);
      return objectResponse(engine.validate(input), input.response_format);
    }
    if (name === "ultrabrain_analyze") {
      const input = normalizeAnalyzeInput(args);
      return objectResponse(engine.analyze(input), input.response_format);
    }
    if (name === "ultrabrain_review") {
      return textResponse(engine.review(normalizeReviewInput(args)));
    }
    if (name === "ultrabrain_status") {
      return jsonResponse(engine.status(readSessionId(args)));
    }
    if (name === "ultrabrain_history") {
      return jsonResponse(engine.history(readSessionId(args), readNumber(args, "limit") ?? 20));
    }
    if (name === "ultrabrain_export") {
      const format = readString(args, "format") ?? "markdown";
      if (!["markdown", "text", "json"].includes(format)) {
        throw new Error("format must be markdown, text, or json.");
      }
      return textResponse(engine.export(readSessionId(args), format as ResponseFormat));
    }
    if (name === "ultrabrain_metrics") {
      return jsonResponse(engine.metrics(readString(args, "session_id")));
    }
    if (name === "ultrabrain_templates") {
      return jsonResponse(engine.templates());
    }
    if (name === "ultrabrain_reset") {
      return jsonResponse(
        engine.reset(normalizeSessionId(args), readBoolean(args, "all_sessions") ?? false),
      );
    }
    throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
  } catch (error) {
    // Protocol-level errors (e.g. unknown tool) must surface as JSON-RPC errors,
    // not as an in-band tool result the caller cannot distinguish from a failure.
    if (error instanceof McpError) {
      throw error;
    }
    return errorResponse(error);
  }
});

function textResponse(text: string) {
  return {
    content: [
      {
        type: "text" as const,
        text,
      },
    ],
  };
}

function jsonResponse(payload: unknown) {
  const result = textResponse(JSON.stringify(payload, null, 2));
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    // Surface the same object as structuredContent so spec-aware hosts get typed
    // data without re-parsing JSON out of the text block.
    return { ...result, structuredContent: payload as Record<string, unknown> };
  }
  return result;
}

function objectResponse(payload: Record<string, unknown>, format: ResponseFormat) {
  if (format === "json") {
    return jsonResponse(payload);
  }
  const lines = Object.entries(payload).map(([key, value]) => `${key}: ${formatValue(value)}`);
  return { ...textResponse(lines.join("\n")), structuredContent: payload };
}

function formatMergeResult(payload: Record<string, unknown>): string {
  const branchIds = Array.isArray(payload.branch_ids) ? payload.branch_ids.join(", ") : "none";
  const createdThought =
    payload.created_thought && typeof payload.created_thought === "object"
      ? (payload.created_thought as Record<string, unknown>)
      : null;
  return [
    "## Ultrabrain Merge",
    "",
    `Session: ${formatValue(payload.session_id)}`,
    `Strategy: ${formatValue(payload.strategy)}`,
    `Branches: ${branchIds}`,
    "",
    "### Synthesis",
    "",
    formatValue(payload.synthesis),
    "",
    "### Created Thought",
    "",
    createdThought
      ? `${formatValue(createdThought.thought_number)}/${formatValue(createdThought.total_thoughts)} ${formatValue(createdThought.thought)}`
      : "none",
  ].join("\n");
}

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const payload: ToolErrorPayload = {
    status: "failed",
    error: message,
    guidance:
      "Use the LCV Ultrabrain tool schema with ultrabrain_* tool names and en-US field descriptions.",
    example: {
      thought:
        "Map the problem, list evidence, compare alternatives, and choose the next verification step.",
      thought_number: 1,
      total_thoughts: 4,
      next_thought_needed: true,
      response_format: "json",
    },
  };
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(payload, null, 2),
      },
    ],
    isError: true,
  };
}

function readResponseFormat(args: unknown): ResponseFormat {
  const format =
    readString(args, "response_format") ?? readString(args, "responseFormat") ?? "json";
  return ["json", "markdown", "text"].includes(format) ? (format as ResponseFormat) : "json";
}

function renderPrompt(name: string, args: Record<string, string>): string {
  if (name === "ultrabrain_problem_breakdown") {
    return [
      "Use Ultrabrain to break down this problem.",
      "",
      `Problem: ${args.problem ?? ""}`,
      args.context ? `Context: ${args.context}` : undefined,
      "",
      "Return evidence, assumptions, hypotheses, verification checks, risks, and next actions.",
    ]
      .filter(Boolean)
      .join("\n");
  }
  if (name === "ultrabrain_critical_review") {
    return [
      "Use Ultrabrain to critically review this subject.",
      "",
      `Subject: ${args.subject ?? ""}`,
      args.evidence ? `Evidence: ${args.evidence}` : undefined,
      "",
      "Identify counterexamples, missing evidence, bias risks, residual risk, and verification steps.",
    ]
      .filter(Boolean)
      .join("\n");
  }
  return [
    "Use Ultrabrain to synthesize these findings.",
    "",
    `Findings: ${args.findings ?? ""}`,
    args.goal ? `Goal: ${args.goal}` : undefined,
    "",
    "Return a decision, branch tradeoffs, carried-forward risks, and concrete next actions.",
  ]
    .filter(Boolean)
    .join("\n");
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "none";
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value);
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    // Session state is persisted synchronously on every mutation, so a clean exit
    // needs no flush; just close the transport and leave a non-torn state dir.
    void server.close().finally(() => process.exit(0));
  });
}

const transport = new StdioServerTransport();
server.connect(transport).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[${SERVER_NAME}] failed to start: ${message}`);
  process.exit(1);
});

void TEMPLATES;
