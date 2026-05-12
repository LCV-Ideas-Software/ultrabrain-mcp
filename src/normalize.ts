import { z } from 'zod';
import type {
  AnalyzeInput,
  BudgetMode,
  InputShape,
  MergeInput,
  QualityMetrics,
  ReasoningMode,
  ResponseFormat,
  ReviewInput,
  StartSessionInput,
  StepType,
  ThoughtInput,
  UpdateThoughtInput,
  ValidateInput,
} from './types.js';

const MAX_TEXT_LENGTH = 20000;
export const DEFAULT_SESSION_ID = 'default';

const responseFormatSchema = z.enum(['json', 'markdown', 'text']);
const reviewFormatSchema = z.enum(['summary', 'linear', 'tree', 'markdown', 'json']);
const mergeStrategySchema = z.enum(['synthesis', 'best_evidence', 'decision']);
const reasoningModeSchema = z.enum([
  'code',
  'serial',
  'parallel',
  'hybrid',
  'critical',
  'analytical',
  'systematic',
  'creative',
  'metacognitive',
  'strategic',
  'dialectical',
  'first_principles',
  'decision_matrix',
  'root_cause',
  'socratic',
]);
const stepTypeSchema = z.enum([
  'analysis',
  'hypothesis',
  'verification',
  'conclusion',
  'assumption',
  'counterargument',
  'synthesis',
  'decision',
  'implementation',
  'review',
]);
const budgetModeSchema = z.enum(['fast', 'balanced', 'thorough', 'exhaustive']);

function pick<T>(raw: Record<string, unknown>, ...keys: string[]): T | undefined {
  for (const key of keys) {
    if (raw[key] !== undefined) {
      return raw[key] as T;
    }
  }
  return undefined;
}

function requireObject(args: unknown): Record<string, unknown> {
  if (!args || typeof args !== 'object' || Array.isArray(args)) {
    throw new Error('Arguments must be an object.');
  }
  return args as Record<string, unknown>;
}

function asBoolean(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') {
      return true;
    }
    if (normalized === 'false') {
      return false;
    }
  }
  return undefined;
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return undefined;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
}

export function asStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const strings = value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean);
  return strings.length ? strings : undefined;
}

function parseEnum<T extends string>(schema: z.ZodType<T>, value: unknown, fallback: T): T {
  const parsed = schema.safeParse(value);
  return parsed.success ? parsed.data : fallback;
}

function detectInputShape(raw: Record<string, unknown>): InputShape {
  const snake = Object.keys(raw).some((key) => key.includes('_'));
  const camel = Object.keys(raw).some((key) => /[a-z][A-Z]/.test(key));
  if (snake && camel) {
    return 'mixed';
  }
  return camel ? 'camel_case' : 'snake_case';
}

export function normalizeQualityMetrics(raw: unknown): QualityMetrics | undefined {
  if (raw === undefined) {
    return undefined;
  }
  let input: unknown = raw;
  if (typeof input === 'string') {
    try {
      input = JSON.parse(input) as unknown;
    } catch {
      return undefined;
    }
  }
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return undefined;
  }
  const metrics = input as Record<string, unknown>;
  const normalized: QualityMetrics = {};
  const mappings: Array<[keyof QualityMetrics, string[]]> = [
    ['logical_consistency', ['logical_consistency', 'logicalConsistency']],
    ['completeness', ['completeness']],
    ['objectivity', ['objectivity']],
    ['practicality', ['practicality']],
    ['clarity', ['clarity']],
    ['depth', ['depth']],
    ['breadth', ['breadth']],
    ['relevance', ['relevance']],
    ['actionability', ['actionability']],
  ];
  for (const [target, keys] of mappings) {
    const value = asNumber(pick(metrics, ...keys));
    if (value !== undefined) {
      normalized[target] = value;
    }
  }
  return Object.keys(normalized).length ? normalized : undefined;
}

export function normalizeThoughtInput(args: unknown): ThoughtInput {
  const raw = requireObject(args);
  const thought = asString(pick(raw, 'thought'));
  const thoughtNumber = asNumber(pick(raw, 'thought_number', 'thoughtNumber'));
  const totalThoughts = asNumber(pick(raw, 'total_thoughts', 'totalThoughts'));
  const nextThoughtNeeded = asBoolean(pick(raw, 'next_thought_needed', 'nextThoughtNeeded'));

  if (!thought) {
    throw new Error('thought is required and must be a non-empty string.');
  }
  if (thought.length > MAX_TEXT_LENGTH) {
    throw new Error(`thought exceeds ${MAX_TEXT_LENGTH} characters.`);
  }
  if (!thoughtNumber || !Number.isInteger(thoughtNumber) || thoughtNumber < 1) {
    throw new Error('thought_number/thoughtNumber must be a positive integer.');
  }
  if (!totalThoughts || !Number.isInteger(totalThoughts) || totalThoughts < 1) {
    throw new Error('total_thoughts/totalThoughts must be a positive integer.');
  }
  if (nextThoughtNeeded === undefined) {
    throw new Error('next_thought_needed/nextThoughtNeeded must be a boolean.');
  }

  const input: ThoughtInput = {
    session_id: asString(pick(raw, 'session_id', 'sessionId')) ?? DEFAULT_SESSION_ID,
    response_format: parseEnum(responseFormatSchema, pick(raw, 'response_format', 'responseFormat'), 'json'),
    input_shape: detectInputShape(raw),
    thought,
    thought_number: thoughtNumber,
    total_thoughts: totalThoughts,
    next_thought_needed: nextThoughtNeeded,
    step_type: parseOptionalEnum(stepTypeSchema, pick(raw, 'step_type', 'stepType')),
    mode: parseEnum(reasoningModeSchema, pick(raw, 'mode', 'reasoningMode', 'ultrabrainMode'), 'hybrid'),
    is_revision: asBoolean(pick(raw, 'is_revision', 'isRevision')),
    revises_thought: asNumber(pick(raw, 'revises_thought', 'revisesThought')),
    branch_from_thought: asNumber(pick(raw, 'branch_from_thought', 'branchFromThought')),
    branch_id: asString(pick(raw, 'branch_id', 'branchId')),
    parent_thought: asNumber(pick(raw, 'parent_thought', 'parentThought')),
    needs_more_thoughts: asBoolean(pick(raw, 'needs_more_thoughts', 'needsMoreThoughts')),
    depth_level: asNumber(pick(raw, 'depth_level', 'depthLevel')),
    max_depth: asNumber(pick(raw, 'max_depth', 'maxDepth')),
    budget_mode: parseEnum(budgetModeSchema, pick(raw, 'budget_mode', 'budgetMode'), 'balanced') as BudgetMode,
    budget_used: asNumber(pick(raw, 'budget_used', 'budgetUsed')),
    confidence: asNumber(pick(raw, 'confidence')),
    meta_checkpoint: asBoolean(pick(raw, 'meta_checkpoint', 'metaCheckpoint')),
    bias_detected: asString(pick(raw, 'bias_detected', 'biasDetected')),
    quality_metrics: normalizeQualityMetrics(pick(raw, 'quality_metrics', 'qualityMetrics')),
    evidence: asStringArray(pick(raw, 'evidence')),
    assumptions: asStringArray(pick(raw, 'assumptions')),
    open_questions: asStringArray(pick(raw, 'open_questions', 'openQuestions')),
    alternatives: asStringArray(pick(raw, 'alternatives')),
    risks: asStringArray(pick(raw, 'risks')),
    next_actions: asStringArray(pick(raw, 'next_actions', 'nextActions')),
    tags: asStringArray(pick(raw, 'tags')),
    perspective: asString(pick(raw, 'perspective')),
    expected_output: asString(pick(raw, 'expected_output', 'expectedOutput')),
    hypothesis: asString(pick(raw, 'hypothesis')),
    verification: asString(pick(raw, 'verification')),
  };

  validateThoughtRules(input);
  return input;
}

export function normalizeStartInput(args: unknown): StartSessionInput {
  const raw = requireObject(args);
  const problem = asString(pick(raw, 'problem'));
  if (!problem) {
    throw new Error('problem is required and must be a non-empty string.');
  }
  return {
    session_id: asString(pick(raw, 'session_id', 'sessionId')),
    problem,
    context: asString(pick(raw, 'context')),
    template: asString(pick(raw, 'template')),
    tags: asStringArray(pick(raw, 'tags')),
    initial_thought: asString(pick(raw, 'initial_thought', 'initialThought')),
    total_thoughts: asNumber(pick(raw, 'total_thoughts', 'totalThoughts')),
    response_format: parseEnum(responseFormatSchema, pick(raw, 'response_format', 'responseFormat'), 'json'),
  };
}

export function normalizeUpdateInput(args: unknown): UpdateThoughtInput {
  const raw = requireObject(args);
  const thoughtNumber = asNumber(pick(raw, 'thought_number', 'thoughtNumber'));
  if (!thoughtNumber || !Number.isInteger(thoughtNumber) || thoughtNumber < 1) {
    throw new Error('thought_number/thoughtNumber must be a positive integer.');
  }
  const confidence = asNumber(pick(raw, 'confidence'));
  if (confidence !== undefined && (confidence < 0 || confidence > 1)) {
    throw new Error('confidence must be between 0 and 1.');
  }
  const input: UpdateThoughtInput = {
    session_id: asString(pick(raw, 'session_id', 'sessionId')) ?? DEFAULT_SESSION_ID,
    thought_number: thoughtNumber,
    branch_id: asString(pick(raw, 'branch_id', 'branchId')),
    thought: asString(pick(raw, 'thought')),
    confidence,
    evidence: asStringArray(pick(raw, 'evidence')),
    assumptions: asStringArray(pick(raw, 'assumptions')),
    open_questions: asStringArray(pick(raw, 'open_questions', 'openQuestions')),
    alternatives: asStringArray(pick(raw, 'alternatives')),
    risks: asStringArray(pick(raw, 'risks')),
    next_actions: asStringArray(pick(raw, 'next_actions', 'nextActions')),
    quality_metrics: normalizeQualityMetrics(pick(raw, 'quality_metrics', 'qualityMetrics')),
    tags: asStringArray(pick(raw, 'tags')),
  };
  if (!hasAnyUpdate(input)) {
    throw new Error('At least one editable field must be provided.');
  }
  return input;
}

export function normalizeReviewInput(args: unknown): ReviewInput {
  const raw = requireObject(args);
  return {
    session_id: asString(pick(raw, 'session_id', 'sessionId')) ?? DEFAULT_SESSION_ID,
    format: parseEnum(reviewFormatSchema, pick(raw, 'format'), 'summary'),
    limit: asNumber(pick(raw, 'limit')),
  };
}

export function normalizeValidateInput(args: unknown): ValidateInput {
  const raw = requireObject(args);
  return {
    session_id: asString(pick(raw, 'session_id', 'sessionId')) ?? DEFAULT_SESSION_ID,
    strict: asBoolean(pick(raw, 'strict')),
    response_format: parseEnum(responseFormatSchema, pick(raw, 'response_format', 'responseFormat'), 'json'),
  };
}

export function normalizeAnalyzeInput(args: unknown): AnalyzeInput {
  const raw = requireObject(args);
  return {
    session_id: asString(pick(raw, 'session_id', 'sessionId')) ?? DEFAULT_SESSION_ID,
    response_format: parseEnum(responseFormatSchema, pick(raw, 'response_format', 'responseFormat'), 'json'),
  };
}

export function normalizeMergeInput(args: unknown): MergeInput {
  const raw = requireObject(args);
  const branchIds = asStringArray(pick(raw, 'branch_ids', 'branchIds'));
  if (!branchIds?.length) {
    throw new Error('branch_ids/branchIds must include at least one branch id.');
  }
  return {
    session_id: asString(pick(raw, 'session_id', 'sessionId')) ?? DEFAULT_SESSION_ID,
    branch_ids: branchIds,
    strategy: parseEnum(mergeStrategySchema, pick(raw, 'strategy'), 'synthesis'),
    create_thought: asBoolean(pick(raw, 'create_thought', 'createThought')),
    response_format: parseEnum(responseFormatSchema, pick(raw, 'response_format', 'responseFormat'), 'json'),
  };
}

export function normalizeSessionId(args: unknown): string {
  const raw = requireObject(args);
  return asString(pick(raw, 'session_id', 'sessionId')) ?? DEFAULT_SESSION_ID;
}

export function readSessionId(args: unknown): string {
  if (!args || typeof args !== 'object' || Array.isArray(args)) {
    return DEFAULT_SESSION_ID;
  }
  return asString(pick(args as Record<string, unknown>, 'session_id', 'sessionId')) ?? DEFAULT_SESSION_ID;
}

export function readBoolean(args: unknown, key: string): boolean | undefined {
  if (!args || typeof args !== 'object' || Array.isArray(args)) {
    return undefined;
  }
  return asBoolean((args as Record<string, unknown>)[key]);
}

export function readNumber(args: unknown, key: string): number | undefined {
  if (!args || typeof args !== 'object' || Array.isArray(args)) {
    return undefined;
  }
  return asNumber((args as Record<string, unknown>)[key]);
}

export function readString(args: unknown, key: string): string | undefined {
  if (!args || typeof args !== 'object' || Array.isArray(args)) {
    return undefined;
  }
  return asString((args as Record<string, unknown>)[key]);
}

function parseOptionalEnum<T extends string>(schema: z.ZodType<T>, value: unknown): T | undefined {
  if (value === undefined) {
    return undefined;
  }
  const parsed = schema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

function validateThoughtRules(input: ThoughtInput): void {
  if (input.is_revision) {
    if (!input.revises_thought) {
      throw new Error('Revision requires revises_thought/revisesThought.');
    }
    if (input.branch_id || input.branch_from_thought) {
      throw new Error('Revision cannot be combined with branch fields.');
    }
  } else if (input.revises_thought !== undefined) {
    throw new Error('revises_thought/revisesThought is only valid when is_revision is true.');
  }

  const hasBranchId = input.branch_id !== undefined;
  const hasBranchFrom = input.branch_from_thought !== undefined;
  if (hasBranchId !== hasBranchFrom) {
    throw new Error('Branching requires both branch_id/branchId and branch_from_thought/branchFromThought.');
  }

  if (input.budget_used !== undefined && (input.budget_used < 0 || input.budget_used > 100)) {
    throw new Error('budget_used/budgetUsed must be between 0 and 100.');
  }

  if (input.confidence !== undefined && (input.confidence < 0 || input.confidence > 1)) {
    throw new Error('confidence must be between 0 and 1.');
  }

  if (input.quality_metrics) {
    validateMetrics(input.quality_metrics);
  }
}

function validateMetrics(metrics: QualityMetrics): void {
  for (const [name, value] of Object.entries(metrics)) {
    if (value !== undefined && (value < 0 || value > 5)) {
      throw new Error(`quality metric ${name} must be between 0 and 5.`);
    }
  }
}

function hasAnyUpdate(input: UpdateThoughtInput): boolean {
  return Boolean(
    input.thought ||
      input.confidence !== undefined ||
      input.evidence ||
      input.assumptions ||
      input.open_questions ||
      input.alternatives ||
      input.risks ||
      input.next_actions ||
      input.quality_metrics ||
      input.tags,
  );
}

export const schemas = {
  responseFormatSchema,
  reasoningModeSchema,
  stepTypeSchema,
  budgetModeSchema,
} satisfies Record<string, z.ZodTypeAny>;
