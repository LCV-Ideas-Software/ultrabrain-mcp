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
  logical_consistency?: number | undefined;
  completeness?: number | undefined;
  objectivity?: number | undefined;
  practicality?: number | undefined;
  clarity?: number | undefined;
  depth?: number | undefined;
  breadth?: number | undefined;
  relevance?: number | undefined;
  actionability?: number | undefined;
}

export interface ThoughtInput {
  session_id: string;
  response_format: ResponseFormat;
  input_shape: InputShape;
  thought: string;
  thought_number: number;
  total_thoughts: number;
  next_thought_needed: boolean;
  step_type?: StepType | undefined;
  mode?: ReasoningMode | undefined;
  is_revision?: boolean | undefined;
  revises_thought?: number | undefined;
  branch_from_thought?: number | undefined;
  branch_id?: string | undefined;
  parent_thought?: number | undefined;
  needs_more_thoughts?: boolean | undefined;
  depth_level?: number | undefined;
  max_depth?: number | undefined;
  budget_mode?: BudgetMode | undefined;
  budget_used?: number | undefined;
  confidence?: number | undefined;
  meta_checkpoint?: boolean | undefined;
  bias_detected?: string | undefined;
  quality_metrics?: QualityMetrics | undefined;
  evidence?: string[] | undefined;
  assumptions?: string[] | undefined;
  open_questions?: string[] | undefined;
  alternatives?: string[] | undefined;
  risks?: string[] | undefined;
  next_actions?: string[] | undefined;
  tags?: string[] | undefined;
  perspective?: string | undefined;
  expected_output?: string | undefined;
  hypothesis?: string | undefined;
  verification?: string | undefined;
}

export interface ThoughtRecord extends ThoughtInput {
  id: string;
  created_at: string;
  updated_at?: string | undefined;
  labels: string[];
  warnings: string[];
  detected_biases: string[];
  quality_score: number;
  suggestions: string[];
  rewritten_thought?: string | undefined;
}

export interface BrainSession {
  id: string;
  created_at: string;
  updated_at: string;
  status: "active" | "completed";
  problem?: string | undefined;
  context?: string | undefined;
  template?: string | undefined;
  tags: string[];
  thoughts: ThoughtRecord[];
  branches: Record<string, ThoughtRecord[]>;
  merged_branches: Record<string, string>;
}

export interface RelatedThought {
  thought_number: number;
  step_type?: StepType | undefined;
  shared_tags: string[];
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
  related_thoughts?: RelatedThought[] | undefined;
  confidence?: number | undefined;
  budget?:
    | {
        mode: BudgetMode;
        used_percent?: number | undefined;
      }
    | undefined;
  labels: string[];
  warnings: string[];
  detected_biases: string[];
  suggestions: string[];
  record: ThoughtRecord;
}

export interface StartSessionInput {
  session_id?: string | undefined;
  problem: string;
  context?: string | undefined;
  template?: string | undefined;
  tags?: string[] | undefined;
  initial_thought?: string | undefined;
  total_thoughts?: number | undefined;
  response_format?: ResponseFormat | undefined;
}

export interface UpdateThoughtInput {
  session_id: string;
  thought_number: number;
  branch_id?: string | undefined;
  thought?: string | undefined;
  confidence?: number | undefined;
  evidence?: string[] | undefined;
  assumptions?: string[] | undefined;
  open_questions?: string[] | undefined;
  alternatives?: string[] | undefined;
  risks?: string[] | undefined;
  next_actions?: string[] | undefined;
  quality_metrics?: QualityMetrics | undefined;
  tags?: string[] | undefined;
}

export interface ReviewInput {
  session_id: string;
  format: "summary" | "linear" | "tree" | "markdown" | "json" | "mermaid";
  limit?: number | undefined;
}

export interface ValidateInput {
  session_id: string;
  strict?: boolean | undefined;
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
  create_thought?: boolean | undefined;
  response_format: ResponseFormat;
}

export interface ToolErrorPayload {
  status: "failed";
  error: string;
  guidance: string;
  example: Record<string, unknown>;
}

export interface UltraBrainEngineOptions {
  persistence_dir?: string | undefined;
}
