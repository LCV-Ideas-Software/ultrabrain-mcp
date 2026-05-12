export type ResponseFormat = "json" | "markdown" | "text";

export type ReasoningMode =
  | "code"
  | "serial"
  | "parallel"
  | "hybrid"
  | "critical"
  | "analytical"
  | "systematic"
  | "creative"
  | "metacognitive"
  | "strategic"
  | "dialectical"
  | "first_principles"
  | "decision_matrix"
  | "root_cause"
  | "socratic";

export type StepType =
  | "analysis"
  | "hypothesis"
  | "verification"
  | "conclusion"
  | "assumption"
  | "counterargument"
  | "synthesis"
  | "decision"
  | "implementation"
  | "review";

export type BudgetMode = "fast" | "balanced" | "thorough" | "exhaustive";

export type InputShape = "snake_case" | "camel_case" | "mixed";

export interface QualityMetrics {
  logical_consistency?: number;
  completeness?: number;
  objectivity?: number;
  practicality?: number;
  clarity?: number;
  depth?: number;
  breadth?: number;
  relevance?: number;
  actionability?: number;
}

export interface ThoughtInput {
  session_id: string;
  response_format: ResponseFormat;
  input_shape: InputShape;
  thought: string;
  thought_number: number;
  total_thoughts: number;
  next_thought_needed: boolean;
  step_type?: StepType;
  mode?: ReasoningMode;
  is_revision?: boolean;
  revises_thought?: number;
  branch_from_thought?: number;
  branch_id?: string;
  parent_thought?: number;
  needs_more_thoughts?: boolean;
  depth_level?: number;
  max_depth?: number;
  budget_mode?: BudgetMode;
  budget_used?: number;
  confidence?: number;
  meta_checkpoint?: boolean;
  bias_detected?: string;
  quality_metrics?: QualityMetrics;
  evidence?: string[];
  assumptions?: string[];
  open_questions?: string[];
  alternatives?: string[];
  risks?: string[];
  next_actions?: string[];
  tags?: string[];
  perspective?: string;
  expected_output?: string;
  hypothesis?: string;
  verification?: string;
}

export interface ThoughtRecord extends ThoughtInput {
  id: string;
  created_at: string;
  updated_at?: string;
  labels: string[];
  warnings: string[];
  detected_biases: string[];
  quality_score: number;
  suggestions: string[];
  rewritten_thought?: string;
}

export interface BrainSession {
  id: string;
  created_at: string;
  updated_at: string;
  status: "active" | "completed";
  problem?: string;
  context?: string;
  template?: string;
  tags: string[];
  thoughts: ThoughtRecord[];
  branches: Record<string, ThoughtRecord[]>;
  merged_branches: Record<string, string>;
}

export interface BrainResult {
  status: "processed";
  session_id: string;
  thought_number: number;
  total_thoughts: number;
  next_thought_needed: boolean;
  thought_history_length: number;
  branches: string[];
  quality_score: number;
  confidence?: number;
  budget?: {
    mode: BudgetMode;
    used_percent?: number;
  };
  labels: string[];
  warnings: string[];
  detected_biases: string[];
  suggestions: string[];
  record: ThoughtRecord;
}

export interface StartSessionInput {
  session_id?: string;
  problem: string;
  context?: string;
  template?: string;
  tags?: string[];
  initial_thought?: string;
  total_thoughts?: number;
  response_format?: ResponseFormat;
}

export interface UpdateThoughtInput {
  session_id: string;
  thought_number: number;
  branch_id?: string;
  thought?: string;
  confidence?: number;
  evidence?: string[];
  assumptions?: string[];
  open_questions?: string[];
  alternatives?: string[];
  risks?: string[];
  next_actions?: string[];
  quality_metrics?: QualityMetrics;
  tags?: string[];
}

export interface ReviewInput {
  session_id: string;
  format: "summary" | "linear" | "tree" | "markdown" | "json";
  limit?: number;
}

export interface ValidateInput {
  session_id: string;
  strict?: boolean;
  response_format: ResponseFormat;
}

export interface AnalyzeInput {
  session_id: string;
  response_format: ResponseFormat;
}

export interface MergeInput {
  session_id: string;
  branch_ids: string[];
  strategy: "synthesis" | "best_evidence" | "decision";
  create_thought?: boolean;
  response_format: ResponseFormat;
}

export interface ToolErrorPayload {
  status: "failed";
  error: string;
  guidance: string;
  example: Record<string, unknown>;
}

export interface UltraBrainEngineOptions {
  persistence_dir?: string;
}
