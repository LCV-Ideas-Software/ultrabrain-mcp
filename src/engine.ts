import type {
  AnalyzeInput,
  BrainResult,
  BrainSession,
  MergeInput,
  QualityMetrics,
  ResponseFormat,
  ReviewInput,
  StartSessionInput,
  ThoughtInput,
  ThoughtRecord,
  UltraBrainEngineOptions,
  UpdateThoughtInput,
  ValidateInput,
} from "./types.js";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";

const MAX_SESSION_THOUGHTS = 300;
const MAX_BRANCH_THOUGHTS = 100;

export const TEMPLATES = [
  {
    id: "architecture_decision",
    title: "Architecture Decision",
    description: "Frame context, constraints, options, tradeoffs, decision, and rollback checks.",
    stages: ["context", "constraints", "options", "tradeoffs", "decision", "verification"],
  },
  {
    id: "bug_analysis",
    title: "Bug Analysis",
    description:
      "Move from symptom to reproduction, hypothesis, evidence, fix, and regression guard.",
    stages: ["symptom", "reproduction", "hypothesis", "evidence", "fix", "regression_guard"],
  },
  {
    id: "feature_planning",
    title: "Feature Planning",
    description:
      "Clarify user goal, scope, UX path, implementation slices, risks, and acceptance checks.",
    stages: ["goal", "scope", "workflow", "implementation", "risks", "acceptance"],
  },
  {
    id: "refactor_plan",
    title: "Refactor Plan",
    description:
      "Separate current behavior, invariants, target shape, migration steps, and verification.",
    stages: ["baseline", "invariants", "target_shape", "migration", "verification"],
  },
  {
    id: "security_review",
    title: "Security Review",
    description:
      "Track trust boundaries, assets, abuse cases, controls, evidence, and residual risk.",
    stages: ["assets", "boundaries", "abuse_cases", "controls", "evidence", "residual_risk"],
  },
] as const;

export class UltraBrainEngine {
  private readonly sessions = new Map<string, BrainSession>();
  private readonly persistenceDir?: string;

  constructor(options: UltraBrainEngineOptions = {}) {
    const persistenceDir = options.persistence_dir?.trim();
    this.persistenceDir = persistenceDir ? resolve(persistenceDir) : undefined;
    if (this.persistenceDir) {
      mkdirSync(this.persistenceDir, { recursive: true });
      this.loadPersistedSessions();
    }
  }

  start(input: StartSessionInput): Record<string, unknown> {
    const sessionId = input.session_id ?? createSessionId();
    if (this.sessions.has(sessionId)) {
      throw new Error(`Session ${sessionId} already exists.`);
    }
    const now = new Date().toISOString();
    const session: BrainSession = {
      id: sessionId,
      created_at: now,
      updated_at: now,
      status: "active",
      problem: input.problem,
      context: input.context,
      template: input.template,
      tags: input.tags ?? [],
      thoughts: [],
      branches: {},
      merged_branches: {},
    };
    this.sessions.set(sessionId, session);

    let firstThought: BrainResult | undefined;
    if (input.initial_thought) {
      firstThought = this.process({
        session_id: sessionId,
        response_format: input.response_format ?? "json",
        input_shape: "snake_case",
        thought: input.initial_thought,
        thought_number: 1,
        total_thoughts: input.total_thoughts ?? 4,
        next_thought_needed: true,
        mode: "hybrid",
        step_type: "analysis",
        evidence: input.context ? [input.context] : undefined,
        tags: input.tags,
      });
    } else {
      this.persistSession(session);
    }

    return {
      status: "started",
      session_id: sessionId,
      problem: input.problem,
      template: this.resolveTemplate(input.template)?.id ?? input.template ?? null,
      tags: session.tags,
      first_thought: firstThought ? firstThought.record : null,
      suggested_next_actions: [
        "Add an analysis step that states the evidence.",
        "Add at least one hypothesis or alternative path before choosing a conclusion.",
        "Use ultrabrain_validate before treating the chain as complete.",
      ],
    };
  }

  process(input: ThoughtInput): BrainResult {
    const session = this.getOrCreateSession(input.session_id);
    this.validateReferences(input, session);
    const warnings = this.buildWarnings(input, session);
    const detectedBiases = this.detectBiases(input);
    const qualityScore = this.scoreQuality(input.quality_metrics, input, warnings);
    const labels = this.buildLabels(input, qualityScore, detectedBiases);
    const suggestions = this.buildSuggestions(input, qualityScore, detectedBiases, warnings);
    const rewrittenThought = this.rewriteThought(input.thought);
    const now = new Date().toISOString();

    const record: ThoughtRecord = {
      ...input,
      id: `${session.id}:${Date.now()}:${input.thought_number}`,
      created_at: now,
      labels,
      warnings,
      detected_biases: detectedBiases,
      quality_score: qualityScore,
      suggestions,
      rewritten_thought: rewrittenThought === input.thought ? undefined : rewrittenThought,
    };

    session.thoughts.push(record);
    trimRecordList(session.thoughts, MAX_SESSION_THOUGHTS);

    if (record.branch_id) {
      const branch = session.branches[record.branch_id] ?? [];
      branch.push(record);
      trimRecordList(branch, MAX_BRANCH_THOUGHTS);
      session.branches[record.branch_id] = branch;
    }

    if (!record.next_thought_needed) {
      session.status = "completed";
    }
    session.updated_at = now;
    this.persistSession(session);

    return {
      status: "processed",
      session_id: session.id,
      thought_number: record.thought_number,
      total_thoughts: record.total_thoughts,
      next_thought_needed: record.next_thought_needed,
      thought_history_length: session.thoughts.length,
      branches: Object.keys(session.branches),
      quality_score: qualityScore,
      confidence: record.confidence,
      budget: {
        mode: record.budget_mode ?? "balanced",
        used_percent: record.budget_used,
      },
      labels,
      warnings,
      detected_biases: detectedBiases,
      suggestions,
      record,
    };
  }

  update(input: UpdateThoughtInput): Record<string, unknown> {
    const session = this.requireSession(input.session_id);
    const list = input.branch_id ? session.branches[input.branch_id] : session.thoughts;
    if (!list) {
      throw new Error(`Branch ${input.branch_id} does not exist.`);
    }
    const record = list.find((thought) => thought.thought_number === input.thought_number);
    if (!record) {
      throw new Error(`Thought ${input.thought_number} was not found.`);
    }
    if (input.thought) record.thought = input.thought;
    if (input.confidence !== undefined) record.confidence = input.confidence;
    if (input.evidence) record.evidence = input.evidence;
    if (input.assumptions) record.assumptions = input.assumptions;
    if (input.open_questions) record.open_questions = input.open_questions;
    if (input.alternatives) record.alternatives = input.alternatives;
    if (input.risks) record.risks = input.risks;
    if (input.next_actions) record.next_actions = input.next_actions;
    if (input.quality_metrics) record.quality_metrics = input.quality_metrics;
    if (input.tags) record.tags = input.tags;

    record.updated_at = new Date().toISOString();
    record.warnings = this.buildWarnings(record, session);
    record.detected_biases = this.detectBiases(record);
    record.quality_score = this.scoreQuality(record.quality_metrics, record, record.warnings);
    record.labels = this.buildLabels(record, record.quality_score, record.detected_biases);
    record.suggestions = this.buildSuggestions(
      record,
      record.quality_score,
      record.detected_biases,
      record.warnings,
    );
    record.rewritten_thought = this.rewriteThought(record.thought);
    if (record.rewritten_thought === record.thought) {
      delete record.rewritten_thought;
    }

    session.updated_at = record.updated_at;
    this.persistSession(session);
    return {
      status: "updated",
      session_id: session.id,
      thought_number: record.thought_number,
      branch_id: input.branch_id ?? null,
      quality_score: record.quality_score,
      warnings: record.warnings,
      detected_biases: record.detected_biases,
      suggestions: record.suggestions,
      record,
    };
  }

  review(input: ReviewInput): string {
    const session = this.requireSession(input.session_id);
    const thoughts = this.limitedThoughts(session, input.limit);
    if (input.format === "json") {
      return JSON.stringify({ ...session, thoughts }, null, 2);
    }
    if (input.format === "tree") {
      return renderTree(session, thoughts);
    }
    if (input.format === "linear") {
      return thoughts
        .map((thought) => `${thought.thought_number}/${thought.total_thoughts}: ${thought.thought}`)
        .join("\n");
    }
    if (input.format === "markdown") {
      return this.export(session.id, "markdown");
    }
    return renderSummary(session, thoughts);
  }

  validate(input: ValidateInput): Record<string, unknown> {
    const session = this.requireSession(input.session_id);
    const thoughts = session.thoughts;
    const issues: string[] = [];
    const strengths: string[] = [];
    const stageCoverage = new Set(thoughts.map((thought) => thought.step_type).filter(Boolean));

    if (!thoughts.length) {
      issues.push("Session has no thoughts.");
    }
    if (!thoughts.some((thought) => thought.evidence?.length)) {
      issues.push("No evidence has been recorded.");
    } else {
      strengths.push("At least one thought records explicit evidence.");
    }
    if (!thoughts.some((thought) => thought.alternatives?.length || thought.branch_id)) {
      issues.push("No alternative path or branch has been explored.");
    } else {
      strengths.push("Alternative paths are present.");
    }
    if (thoughts.some((thought) => thought.detected_biases.length)) {
      issues.push("One or more cognitive bias warnings remain open.");
    }
    if (!thoughts.some((thought) => thought.step_type === "verification" || thought.verification)) {
      issues.push("No verification step is present.");
    } else {
      strengths.push("Verification is represented in the chain.");
    }
    if (!thoughts.at(-1)?.next_thought_needed) {
      strengths.push("The latest thought marks the chain as complete.");
    } else if (input.strict) {
      issues.push("Strict validation requires a final thought with next_thought_needed=false.");
    }
    if (input.strict && stageCoverage.size < 3) {
      issues.push("Strict validation expects at least three distinct step types.");
    }

    return {
      status: issues.length ? "needs_work" : "valid",
      session_id: session.id,
      strict: Boolean(input.strict),
      issue_count: issues.length,
      strength_count: strengths.length,
      issues,
      strengths,
      metrics: this.metrics(session.id),
    };
  }

  analyze(input: AnalyzeInput): Record<string, unknown> {
    const session = this.requireSession(input.session_id);
    const thoughts = session.thoughts;
    const avgQuality = average(thoughts.map((thought) => thought.quality_score));
    const avgConfidence = average(
      thoughts
        .map((thought) => thought.confidence)
        .filter((value): value is number => value !== undefined),
    );
    const biasCounts = countBy(thoughts.flatMap((thought) => thought.detected_biases));
    const labelCounts = countBy(thoughts.flatMap((thought) => thought.labels));
    const unresolvedQuestions = thoughts.flatMap((thought) => thought.open_questions ?? []);

    return {
      status: "analyzed",
      session_id: session.id,
      thought_count: thoughts.length,
      branch_count: Object.keys(session.branches).length,
      average_quality: avgQuality,
      average_confidence: avgConfidence,
      bias_counts: biasCounts,
      label_counts: labelCounts,
      unresolved_questions: unresolvedQuestions,
      recommendations: this.analysisRecommendations(
        session,
        avgQuality,
        unresolvedQuestions,
        biasCounts,
      ),
    };
  }

  merge(input: MergeInput): Record<string, unknown> {
    const session = this.requireSession(input.session_id);
    const missing = input.branch_ids.filter((id) => !session.branches[id]);
    if (missing.length) {
      throw new Error(`Unknown branch id(s): ${missing.join(", ")}`);
    }
    const branchThoughts = input.branch_ids.flatMap((id) => session.branches[id]);
    const best = [...branchThoughts].sort((a, b) => b.quality_score - a.quality_score)[0];
    const synthesis = this.buildMergeSynthesis(input, branchThoughts, best);
    const mergeId = input.branch_ids.join("+");
    session.merged_branches[mergeId] = synthesis;

    let createdThought: ThoughtRecord | undefined;
    if (input.create_thought) {
      const nextNumber = (session.thoughts.at(-1)?.thought_number ?? 0) + 1;
      const result = this.process({
        session_id: session.id,
        response_format: input.response_format,
        input_shape: "snake_case",
        thought: synthesis,
        thought_number: nextNumber,
        total_thoughts: Math.max(nextNumber, session.thoughts.at(-1)?.total_thoughts ?? nextNumber),
        next_thought_needed: true,
        step_type: "synthesis",
        mode: "hybrid",
        evidence: branchThoughts.flatMap((thought) => thought.evidence ?? []).slice(0, 10),
        alternatives: input.branch_ids,
      });
      createdThought = result.record;
    }

    session.updated_at = new Date().toISOString();
    this.persistSession(session);
    return {
      status: "merged",
      session_id: session.id,
      branch_ids: input.branch_ids,
      strategy: input.strategy,
      synthesis,
      created_thought: createdThought ?? null,
    };
  }

  status(sessionId = "default"): Record<string, unknown> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return {
        status: "empty",
        session_id: sessionId,
        thought_count: 0,
        branch_count: 0,
      };
    }
    return {
      status: session.status,
      session_id: session.id,
      problem: session.problem ?? null,
      template: session.template ?? null,
      tags: session.tags,
      created_at: session.created_at,
      updated_at: session.updated_at,
      thought_count: session.thoughts.length,
      branch_count: Object.keys(session.branches).length,
      branches: Object.keys(session.branches),
      latest_thought_number: session.thoughts.at(-1)?.thought_number ?? null,
      latest_quality_score: session.thoughts.at(-1)?.quality_score ?? null,
    };
  }

  reset(sessionId = "default", allSessions = false): Record<string, unknown> {
    if (allSessions) {
      const removed = this.sessions.size;
      this.sessions.clear();
      this.deletePersistedSessions();
      return { status: "reset", all_sessions: true, removed_sessions: removed };
    }
    const existed = this.sessions.delete(sessionId);
    if (existed) {
      this.deletePersistedSession(sessionId);
    }
    return { status: "reset", session_id: sessionId, existed };
  }

  history(sessionId = "default", limit = 20): Record<string, unknown> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return { session_id: sessionId, thoughts: [], branches: [] };
    }
    const safeLimit = Math.min(Math.max(limit, 1), MAX_SESSION_THOUGHTS);
    return {
      session_id: session.id,
      thoughts: session.thoughts.slice(-safeLimit),
      branches: Object.keys(session.branches),
      merged_branches: session.merged_branches,
    };
  }

  export(sessionId = "default", format: ResponseFormat = "markdown"): string {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return format === "json"
        ? JSON.stringify({ session_id: sessionId, thoughts: [] }, null, 2)
        : `Session ${sessionId} has no thoughts.`;
    }
    if (format === "json") {
      return JSON.stringify(session, null, 2);
    }
    if (format === "text") {
      return session.thoughts
        .map((thought) => `${thought.thought_number}/${thought.total_thoughts}: ${thought.thought}`)
        .join("\n");
    }
    const lines = [
      `# Ultrabrain Session ${session.id}`,
      "",
      session.problem ? `Problem: ${session.problem}` : undefined,
      session.context ? `Context: ${session.context}` : undefined,
      `Created: ${session.created_at}`,
      `Updated: ${session.updated_at}`,
      `Status: ${session.status}`,
      `Thoughts: ${session.thoughts.length}`,
      `Branches: ${Object.keys(session.branches).join(", ") || "none"}`,
      "",
      "## Thoughts",
      "",
    ].filter((line): line is string => line !== undefined);
    for (const thought of session.thoughts) {
      lines.push(`### ${thought.thought_number}/${thought.total_thoughts}`);
      lines.push("");
      lines.push(thought.thought);
      lines.push("");
      if (thought.rewritten_thought) {
        lines.push(`Rewritten: ${thought.rewritten_thought}`);
      }
      if (thought.labels.length) {
        lines.push(`Labels: ${thought.labels.join(", ")}`);
      }
      lines.push(`Quality: ${Math.round(thought.quality_score * 100)}%`);
      if (thought.evidence?.length) {
        lines.push(`Evidence: ${thought.evidence.join("; ")}`);
      }
      if (thought.open_questions?.length) {
        lines.push(`Open questions: ${thought.open_questions.join("; ")}`);
      }
      if (thought.suggestions.length) {
        lines.push(`Suggestions: ${thought.suggestions.join("; ")}`);
      }
      lines.push("");
    }
    return lines.join("\n");
  }

  metrics(sessionId?: string): Record<string, unknown> {
    const sessions = sessionId
      ? [this.requireSession(sessionId)]
      : Array.from(this.sessions.values());
    const thoughts = sessions.flatMap((session) => session.thoughts);
    return {
      session_count: sessions.length,
      thought_count: thoughts.length,
      branch_count: sessions.reduce(
        (sum, session) => sum + Object.keys(session.branches).length,
        0,
      ),
      average_quality: average(thoughts.map((thought) => thought.quality_score)),
      average_confidence: average(
        thoughts
          .map((thought) => thought.confidence)
          .filter((value): value is number => value !== undefined),
      ),
      bias_counts: countBy(thoughts.flatMap((thought) => thought.detected_biases)),
      mode_counts: countBy(thoughts.map((thought) => thought.mode ?? "hybrid")),
      step_type_counts: countBy(thoughts.map((thought) => thought.step_type ?? "analysis")),
    };
  }

  templates(): Record<string, unknown> {
    return { templates: TEMPLATES };
  }

  listSessions(): Record<string, unknown> {
    return {
      sessions: Array.from(this.sessions.values()).map((session) => ({
        id: session.id,
        status: session.status,
        problem: session.problem ?? null,
        updated_at: session.updated_at,
        thought_count: session.thoughts.length,
        branch_count: Object.keys(session.branches).length,
      })),
    };
  }

  resource(uri: string): unknown {
    if (uri === "ultrabrain://sessions") {
      return this.listSessions();
    }
    const sessionMatch = /^ultrabrain:\/\/session\/(.+)$/.exec(uri);
    if (sessionMatch) {
      const session = this.requireSession(decodeURIComponent(sessionMatch[1] ?? ""));
      return session;
    }
    const templateMatch = /^ultrabrain:\/\/template\/(.+)$/.exec(uri);
    if (templateMatch) {
      const template = this.resolveTemplate(decodeURIComponent(templateMatch[1] ?? ""));
      if (!template) {
        throw new Error(`Unknown template: ${templateMatch[1]}`);
      }
      return template;
    }
    throw new Error(`Unknown resource URI: ${uri}`);
  }

  private getOrCreateSession(sessionId: string): BrainSession {
    const existing = this.sessions.get(sessionId);
    if (existing) {
      return existing;
    }
    const now = new Date().toISOString();
    const session: BrainSession = {
      id: sessionId,
      created_at: now,
      updated_at: now,
      status: "active",
      tags: [],
      thoughts: [],
      branches: {},
      merged_branches: {},
    };
    this.sessions.set(sessionId, session);
    return session;
  }

  private requireSession(sessionId: string): BrainSession {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} does not exist.`);
    }
    return session;
  }

  private validateReferences(input: ThoughtInput, session: BrainSession): void {
    if (input.revises_thought !== undefined && !hasActiveThought(session, input.revises_thought)) {
      throw new Error("revises_thought/revisesThought must reference an existing active thought.");
    }
    if (
      input.branch_from_thought !== undefined &&
      !hasActiveThought(session, input.branch_from_thought)
    ) {
      throw new Error(
        "branch_from_thought/branchFromThought must reference an existing active thought.",
      );
    }
    if (input.parent_thought !== undefined && !hasActiveThought(session, input.parent_thought)) {
      throw new Error("parent_thought/parentThought must reference an existing active thought.");
    }
  }

  private resolveTemplate(templateId: string | undefined) {
    return TEMPLATES.find((template) => template.id === templateId);
  }

  private limitedThoughts(session: BrainSession, limit: number | undefined): ThoughtRecord[] {
    const safeLimit =
      limit === undefined
        ? session.thoughts.length
        : Math.min(Math.max(limit, 1), MAX_SESSION_THOUGHTS);
    return session.thoughts.slice(-safeLimit);
  }

  private buildWarnings(input: ThoughtInput, session: BrainSession): string[] {
    const warnings: string[] = [];
    if (input.thought_number > input.total_thoughts && !input.needs_more_thoughts) {
      warnings.push(
        "thought_number exceeds total_thoughts; set needs_more_thoughts when extending a chain.",
      );
    }
    if (input.branch_from_thought && input.branch_from_thought > session.thoughts.length) {
      warnings.push("branch_from_thought points beyond current session history.");
    }
    if (input.step_type === "verification" && !input.evidence?.length && !input.verification) {
      warnings.push("Verification steps should include evidence or a verification note.");
    }
    if (input.step_type === "conclusion" && input.next_thought_needed) {
      warnings.push("Conclusion steps usually close the chain or name the remaining check.");
    }
    if (input.confidence !== undefined && input.confidence > 0.9 && !input.evidence?.length) {
      warnings.push("High confidence without evidence can hide overconfidence.");
    }
    if (
      input.meta_checkpoint ||
      nearProgressCheckpoint(input.thought_number, input.total_thoughts)
    ) {
      warnings.push("Meta checkpoint: verify scope, evidence, alternatives, and residual risk.");
    }
    if (input.expected_output && !input.next_actions?.length) {
      warnings.push("expected_output is set; add next_actions when execution follow-up matters.");
    }
    return warnings;
  }

  private buildLabels(
    input: ThoughtInput,
    qualityScore: number,
    detectedBiases: string[],
  ): string[] {
    const labels = new Set<string>();
    labels.add(input.mode ?? "hybrid");
    labels.add(input.step_type ?? "analysis");
    if (input.perspective) labels.add(`perspective:${slug(input.perspective)}`);
    if (input.parent_thought) labels.add(`parent:${input.parent_thought}`);
    if (input.depth_level) labels.add(`depth:${input.depth_level}`);
    if (input.max_depth) labels.add(`max-depth:${input.max_depth}`);
    if (input.expected_output) labels.add("expected-output");
    if (input.is_revision && input.revises_thought) labels.add(`revision:${input.revises_thought}`);
    if (input.branch_id) labels.add(`branch:${input.branch_id}`);
    if (input.meta_checkpoint || nearProgressCheckpoint(input.thought_number, input.total_thoughts))
      labels.add("meta-checkpoint");
    if (qualityScore < 0.6) labels.add("quality-watch");
    if (detectedBiases.length) labels.add("bias-watch");
    for (const tag of input.tags ?? []) labels.add(`tag:${slug(tag)}`);
    return Array.from(labels);
  }

  private scoreQuality(
    metrics: QualityMetrics | undefined,
    input: ThoughtInput,
    warnings: string[],
  ): number {
    if (metrics && Object.keys(metrics).length) {
      const values = Object.values(metrics).filter(
        (value): value is number => typeof value === "number",
      );
      if (values.length) {
        return clamp(values.reduce((sum, value) => sum + value, 0) / values.length / 5);
      }
    }
    let score = 0.64;
    if (input.evidence?.length) score += 0.08;
    if (input.assumptions?.length) score += 0.05;
    if (input.open_questions?.length) score += 0.05;
    if (input.alternatives?.length || input.branch_id) score += 0.06;
    if (input.risks?.length) score += 0.05;
    if (input.next_actions?.length || input.verification) score += 0.06;
    if (input.expected_output) score += 0.03;
    if (input.depth_level !== undefined && input.depth_level > 1) score += 0.02;
    if (input.thought.length < 30) score -= 0.1;
    if (input.confidence !== undefined && input.confidence > 0.9 && !input.evidence?.length)
      score -= 0.06;
    score -= warnings.filter((warning) => !warning.startsWith("Meta checkpoint")).length * 0.04;
    return clamp(score);
  }

  private detectBiases(input: ThoughtInput): string[] {
    const biases = new Set<string>();
    if (input.bias_detected) {
      biases.add(input.bias_detected);
    }
    const thought = input.thought.toLowerCase();
    if (
      /\b(obvious|obviously|certain|certainly|guaranteed|always|never|undeniable)\b/.test(thought)
    ) {
      biases.add("overconfidence");
    }
    if (
      /\b(prove|confirm|justify|defend)\b/.test(thought) &&
      /\b(my|our|existing|current|chosen)\b/.test(thought)
    ) {
      biases.add("confirmation");
    }
    if (input.thought_number <= 2 && input.confidence !== undefined && input.confidence > 0.9) {
      biases.add("early-overconfidence");
    }
    if (
      /\b(first|initial|original)\b/.test(thought) &&
      /\b(best|correct|right|final)\b/.test(thought)
    ) {
      biases.add("anchoring");
    }
    if (/\b(recent|latest|headline|memorable)\b/.test(thought) && !input.evidence?.length) {
      biases.add("availability");
    }
    if (/\b(already invested|too much work|cannot stop|sunk cost)\b/.test(thought)) {
      biases.add("sunk-cost");
    }
    return Array.from(biases);
  }

  private buildSuggestions(
    input: ThoughtInput,
    qualityScore: number,
    detectedBiases: string[],
    warnings: string[],
  ): string[] {
    const suggestions: string[] = [];
    if (input.thought_number % 3 === 0 && input.next_thought_needed) {
      suggestions.push("Checkpoint: decide whether to branch, revise, or narrow the next step.");
    }
    if (
      input.meta_checkpoint ||
      nearProgressCheckpoint(input.thought_number, input.total_thoughts)
    ) {
      suggestions.push(
        "Meta review: confirm scope, evidence, alternatives, and residual risk before continuing.",
      );
    }
    if (qualityScore < 0.6) {
      suggestions.push(
        "Add evidence, assumptions, alternatives, or a falsifiable check before relying on this thought.",
      );
    }
    if (detectedBiases.length) {
      suggestions.push("Name a counterexample or disconfirming test before proceeding.");
    }
    if (warnings.length) {
      suggestions.push(
        "Resolve validation warnings before treating this reasoning chain as complete.",
      );
    }
    if (!input.next_thought_needed) {
      suggestions.push("Final thought reached; summarize the decision and remaining risks.");
    }
    return suggestions;
  }

  private rewriteThought(thought: string): string {
    return thought
      .replace(/\s+/g, " ")
      .replace(/\bcan't\b/gi, "cannot")
      .replace(/\bwon't\b/gi, "will not")
      .replace(/\bdoesn't\b/gi, "does not")
      .replace(/\bisn't\b/gi, "is not")
      .trim();
  }

  private analysisRecommendations(
    session: BrainSession,
    averageQuality: number | null,
    unresolvedQuestions: string[],
    biasCounts: Record<string, number>,
  ): string[] {
    const recommendations: string[] = [];
    if (averageQuality === null || averageQuality < 0.7) {
      recommendations.push(
        "Raise quality by adding evidence, alternatives, risks, and next checks.",
      );
    }
    if (unresolvedQuestions.length) {
      recommendations.push("Answer or explicitly park unresolved questions before closure.");
    }
    if (Object.keys(biasCounts).length) {
      recommendations.push("Run a counterexample pass against detected bias warnings.");
    }
    if (!Object.keys(session.branches).length) {
      recommendations.push("Consider one branch for a materially different approach.");
    }
    if (!recommendations.length) {
      recommendations.push(
        "The chain is coherent; use validation output as the closure checklist.",
      );
    }
    return recommendations;
  }

  private buildMergeSynthesis(
    input: MergeInput,
    thoughts: ThoughtRecord[],
    best: ThoughtRecord | undefined,
  ): string {
    const evidence = thoughts.flatMap((thought) => thought.evidence ?? []).slice(0, 5);
    const risks = thoughts.flatMap((thought) => thought.risks ?? []).slice(0, 5);
    const base = `Merged branches ${input.branch_ids.join(", ")} using ${input.strategy}.`;
    const bestLine = best
      ? `Highest-quality branch thought: ${best.thought}`
      : "No branch thought was available.";
    const evidenceLine = evidence.length
      ? `Evidence considered: ${evidence.join("; ")}.`
      : "No explicit evidence was recorded in the merged branches.";
    const riskLine = risks.length
      ? `Risks carried forward: ${risks.join("; ")}.`
      : "No explicit branch risks were recorded.";
    return `${base} ${bestLine} ${evidenceLine} ${riskLine}`;
  }

  private loadPersistedSessions(): void {
    if (!this.persistenceDir) {
      return;
    }
    for (const file of readdirSync(this.persistenceDir)) {
      if (!file.endsWith(".json")) {
        continue;
      }
      const path = join(this.persistenceDir, file);
      try {
        const parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;
        if (isBrainSession(parsed)) {
          this.sessions.set(parsed.id, parsed);
        }
      } catch {
        // Ignore corrupt session files so one bad transcript does not block MCP startup.
      }
    }
  }

  private persistSession(session: BrainSession): void {
    if (!this.persistenceDir) {
      return;
    }
    mkdirSync(this.persistenceDir, { recursive: true });
    writeFileSync(this.sessionPath(session.id), `${JSON.stringify(session, null, 2)}\n`, "utf8");
  }

  private deletePersistedSession(sessionId: string): void {
    if (!this.persistenceDir) {
      return;
    }
    const path = this.sessionPath(sessionId);
    if (existsSync(path)) {
      unlinkSync(path);
    }
  }

  private deletePersistedSessions(): void {
    if (!this.persistenceDir || !existsSync(this.persistenceDir)) {
      return;
    }
    for (const file of readdirSync(this.persistenceDir)) {
      if (file.endsWith(".json")) {
        rmSync(join(this.persistenceDir, file), { force: true });
      }
    }
  }

  private sessionPath(sessionId: string): string {
    return join(this.persistenceDir ?? "", `${encodeURIComponent(sessionId)}.json`);
  }
}

export function formatResult(result: BrainResult, format = result.record.response_format): string {
  if (format === "json") {
    return JSON.stringify(toJsonPayload(result), null, 2);
  }
  if (format === "markdown") {
    return [
      `## Ultrabrain ${result.thought_number}/${result.total_thoughts}`,
      "",
      result.record.thought,
      "",
      result.record.rewritten_thought ? `Rewritten: ${result.record.rewritten_thought}` : undefined,
      `Quality: ${Math.round(result.quality_score * 100)}%`,
      result.confidence !== undefined
        ? `Confidence: ${Math.round(result.confidence * 100)}%`
        : undefined,
      result.detected_biases.length ? `Biases: ${result.detected_biases.join(", ")}` : undefined,
      result.suggestions.length ? `Next: ${result.suggestions.join(" ")}` : undefined,
    ]
      .filter(Boolean)
      .join("\n");
  }
  const labels = result.labels.length ? `[${result.labels.join(", ")}] ` : "";
  const metadata = [
    `Quality Score: ${Math.round(result.quality_score * 100)}%`,
    `Budget: ${result.budget?.mode ?? "balanced"}${result.budget?.used_percent !== undefined ? ` ${result.budget.used_percent}%` : ""}`,
    result.confidence !== undefined
      ? `Confidence: ${Math.round(result.confidence * 100)}%`
      : undefined,
    result.detected_biases.length
      ? `Bias Detected: ${result.detected_biases.join(", ")}`
      : undefined,
    result.suggestions.length ? `Suggested Next: ${result.suggestions[0]}` : undefined,
  ]
    .filter(Boolean)
    .join("\n");
  return `${labels}${result.record.thought}\n\n${metadata}`;
}

function toJsonPayload(result: BrainResult): Record<string, unknown> {
  return {
    status: result.status,
    session_id: result.session_id,
    thought_number: result.thought_number,
    total_thoughts: result.total_thoughts,
    next_thought_needed: result.next_thought_needed,
    thought_history_length: result.thought_history_length,
    branches: result.branches,
    quality_score: result.quality_score,
    confidence: result.confidence,
    budget: result.budget,
    labels: result.labels,
    warnings: result.warnings,
    detected_biases: result.detected_biases,
    suggestions: result.suggestions,
    record: result.record,
  };
}

function createSessionId(): string {
  return `ub-${Date.now().toString(36)}`;
}

function clamp(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function average(values: number[]): number | null {
  if (!values.length) {
    return null;
  }
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(4));
}

function countBy(values: string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const value of values) {
    counts[value] = (counts[value] ?? 0) + 1;
  }
  return counts;
}

function nearProgressCheckpoint(thoughtNumber: number, totalThoughts: number): boolean {
  if (totalThoughts < 4) {
    return false;
  }
  const progress = thoughtNumber / totalThoughts;
  return [0.25, 0.5, 0.75].some((checkpoint) => Math.abs(progress - checkpoint) <= 0.04);
}

function slug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function renderSummary(session: BrainSession, thoughts: ThoughtRecord[]): string {
  const latest = thoughts.at(-1);
  const branches = Object.keys(session.branches);
  return [
    `Session: ${session.id}`,
    session.problem ? `Problem: ${session.problem}` : undefined,
    `Status: ${session.status}`,
    `Thoughts: ${thoughts.length}`,
    `Branches: ${branches.join(", ") || "none"}`,
    latest
      ? `Latest: ${latest.thought_number}/${latest.total_thoughts} ${latest.thought}`
      : "Latest: none",
    latest ? `Latest quality: ${Math.round(latest.quality_score * 100)}%` : undefined,
  ]
    .filter(Boolean)
    .join("\n");
}

function renderTree(session: BrainSession, thoughts: ThoughtRecord[]): string {
  const lines = [`${session.id}`];
  for (const thought of thoughts) {
    lines.push(
      `|-- ${thought.thought_number}/${thought.total_thoughts} ${thought.step_type ?? "analysis"}: ${thought.thought}`,
    );
    for (const branch of Object.entries(session.branches)) {
      const [branchId, branchThoughts] = branch;
      if (branchThoughts.some((branchThought) => branchThought.id === thought.id)) {
        lines.push(`|   |-- branch:${branchId}`);
      }
    }
  }
  return lines.join("\n");
}

function trimRecordList(records: ThoughtRecord[], max: number): void {
  while (records.length > max) {
    const protectedThoughts = referencedThoughtNumbers(records);
    const removableIndex = records.findIndex(
      (record) => !protectedThoughts.has(record.thought_number),
    );
    if (removableIndex === -1) {
      break;
    }
    records.splice(removableIndex, 1);
  }
}

function referencedThoughtNumbers(records: ThoughtRecord[]): Set<number> {
  const referenced = new Set<number>();
  for (const record of records) {
    if (record.revises_thought !== undefined) {
      referenced.add(record.revises_thought);
    }
    if (record.branch_from_thought !== undefined) {
      referenced.add(record.branch_from_thought);
    }
    if (record.parent_thought !== undefined) {
      referenced.add(record.parent_thought);
    }
  }
  return referenced;
}

function hasActiveThought(session: BrainSession, thoughtNumber: number): boolean {
  return session.thoughts.some((thought) => thought.thought_number === thoughtNumber);
}

function isBrainSession(value: unknown): value is BrainSession {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const candidate = value as Partial<BrainSession>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.created_at === "string" &&
    typeof candidate.updated_at === "string" &&
    (candidate.status === "active" || candidate.status === "completed") &&
    Array.isArray(candidate.tags) &&
    Array.isArray(candidate.thoughts) &&
    Boolean(candidate.branches) &&
    typeof candidate.branches === "object" &&
    Boolean(candidate.merged_branches) &&
    typeof candidate.merged_branches === "object"
  );
}
