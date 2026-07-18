import { describe, expect, it } from "vitest";
import { UltraBrainEngine } from "../src/engine.js";
import {
  normalizeStartInput,
  normalizeThoughtInput,
  normalizeUpdateInput,
} from "../src/normalize.js";
import { thought } from "./helpers.js";

describe("B2: reserved object keys are rejected as branch ids before any mutation", () => {
  it("rejects a __proto__ branch id without half-applying the thought", () => {
    const engine = new UltraBrainEngine();
    engine.process(thought({ session_id: "s", thought_number: 1 }));
    expect(() =>
      engine.process(
        thought({
          session_id: "s",
          thought_number: 2,
          branch_id: "__proto__",
          branch_from_thought: 1,
        }),
      ),
    ).toThrow();
    const status = engine.status("s") as { thought_count: number };
    expect(status.thought_count).toBe(1);
  });
});

describe("B5: ultrabrain_update enforces the same caps as the think path", () => {
  it("rejects an over-long thought", () => {
    expect(() => normalizeUpdateInput({ thought_number: 1, thought: "x".repeat(20001) })).toThrow(
      /20000/,
    );
  });

  it("rejects out-of-range quality metrics", () => {
    expect(() =>
      normalizeUpdateInput({ thought_number: 1, quality_metrics: { clarity: 6 } }),
    ).toThrow(/between 0 and 5/);
  });
});

describe("B6: enum values are accepted case-insensitively", () => {
  it("normalizes a capitalized step_type", () => {
    const input = normalizeThoughtInput({
      thought: "A verification thought with sufficient length.",
      thought_number: 1,
      total_thoughts: 4,
      next_thought_needed: true,
      step_type: "Verification",
    });
    expect(input.step_type).toBe("verification");
  });

  it("normalizes a capitalized mode", () => {
    const input = normalizeThoughtInput({
      thought: "A root-cause thought with sufficient length.",
      thought_number: 1,
      total_thoughts: 4,
      next_thought_needed: true,
      mode: "Root_Cause",
    });
    expect(input.mode).toBe("root_cause");
  });
});

describe("B7: ultrabrain_start validates the seeded chain", () => {
  it("rejects a non-positive total_thoughts", () => {
    expect(() => normalizeStartInput({ problem: "ship it", total_thoughts: -3 })).toThrow();
  });

  it("rejects an over-long initial_thought", () => {
    expect(() =>
      normalizeStartInput({ problem: "ship it", initial_thought: "x".repeat(20001) }),
    ).toThrow(/20000/);
  });
});

describe("B11: session ids are length-bounded before they enter the engine", () => {
  it("rejects an unbounded session id", () => {
    const engine = new UltraBrainEngine();
    expect(() =>
      engine.process(thought({ session_id: "x".repeat(200), thought_number: 1 })),
    ).toThrow();
  });
});
