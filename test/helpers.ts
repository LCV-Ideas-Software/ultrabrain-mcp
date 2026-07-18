import type { ThoughtInput } from "../src/types.js";

/**
 * Build a valid ThoughtInput for engine.process, filling required fields with
 * sensible defaults so tests only specify what they exercise.
 */
export function thought(
  overrides: Partial<ThoughtInput> & { thought_number: number },
): ThoughtInput {
  return {
    session_id: "test",
    response_format: "json",
    input_shape: "snake_case",
    thought: `Thought number ${overrides.thought_number} with enough length to score well.`,
    total_thoughts: 4,
    next_thought_needed: true,
    ...overrides,
  } as ThoughtInput;
}
