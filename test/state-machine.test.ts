import { describe, expect, it } from "vitest";
import { trimRecordList, UltraBrainEngine } from "../src/engine.js";
import type { ThoughtRecord } from "../src/types.js";
import { thought } from "./helpers.js";

describe("B1: update without branch_id targets the main-chain record, not a same-numbered branch record", () => {
  it("edits the non-branch thought when a branch shares the number", () => {
    const engine = new UltraBrainEngine();
    engine.process(thought({ session_id: "s", thought_number: 1 }));
    engine.process(thought({ session_id: "s", thought_number: 2 }));
    engine.process(
      thought({ session_id: "s", thought_number: 3, branch_id: "b", branch_from_thought: 2 }),
    );
    engine.process(thought({ session_id: "s", thought_number: 3 }));

    const result = engine.update({
      session_id: "s",
      thought_number: 3,
      evidence: ["edits the main chain"],
    }) as { record: { branch_id?: string; evidence?: string[] } };

    expect(result.record.branch_id).toBeUndefined();
    expect(result.record.evidence).toEqual(["edits the main chain"]);
  });
});

describe("B8: session status reverts to active and merge numbering uses the max thought number", () => {
  it("returns to active when a new thought arrives after completion", () => {
    const engine = new UltraBrainEngine();
    engine.process(thought({ session_id: "s", thought_number: 1, next_thought_needed: false }));
    expect((engine.status("s") as { status: string }).status).toBe("completed");
    engine.process(thought({ session_id: "s", thought_number: 2, next_thought_needed: true }));
    expect((engine.status("s") as { status: string }).status).toBe("active");
  });

  it("derives the merge thought number from the maximum, not the last array element", () => {
    const engine = new UltraBrainEngine();
    engine.process(thought({ session_id: "s", thought_number: 1 }));
    engine.process(thought({ session_id: "s", thought_number: 2 }));
    engine.process(thought({ session_id: "s", thought_number: 3 }));
    // Branch record numbered 2 lands at the end of session.thoughts.
    engine.process(
      thought({ session_id: "s", thought_number: 2, branch_id: "b", branch_from_thought: 1 }),
    );

    const merged = engine.merge({
      session_id: "s",
      branch_ids: ["b"],
      strategy: "synthesis",
      create_thought: true,
      response_format: "json",
    }) as { created_thought: { thought_number: number } | null };

    expect(merged.created_thought?.thought_number).toBe(4);
  });
});

describe("B9: trimming never discards the most recent record", () => {
  it("keeps the newest thought even when every older record is referenced", () => {
    const records = [
      { thought_number: 1, parent_thought: 2 },
      { thought_number: 2, parent_thought: 1 },
      { thought_number: 3 },
    ] as ThoughtRecord[];
    trimRecordList(records, 2);
    expect(records.some((r) => r.thought_number === 3)).toBe(true);
  });
});
