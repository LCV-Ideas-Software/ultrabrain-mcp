import { describe, expect, it } from "vitest";
import { UltraBrainEngine } from "../src/engine.js";
import { thought } from "./helpers.js";

describe("C7: checkpoint noise does not fire on the first thought of a chain", () => {
  it("omits the meta-checkpoint label on thought 1 of 4", () => {
    const engine = new UltraBrainEngine();
    const result = engine.process(
      thought({ session_id: "s", thought_number: 1, total_thoughts: 4 }),
    );
    expect(result.labels).not.toContain("meta-checkpoint");
  });

  it("still fires a genuine 25% checkpoint on a later thought", () => {
    const engine = new UltraBrainEngine();
    engine.process(thought({ session_id: "s", thought_number: 1, total_thoughts: 8 }));
    const result = engine.process(
      thought({ session_id: "s", thought_number: 2, total_thoughts: 8 }),
    );
    expect(result.labels).toContain("meta-checkpoint");
  });
});

describe("C7: rewriteThought preserves newlines", () => {
  it("keeps line breaks while collapsing horizontal whitespace", () => {
    const engine = new UltraBrainEngine();
    const result = engine.process(
      thought({
        session_id: "s",
        thought_number: 1,
        thought: "First line here.\nSecond    line    with    spaces.",
      }),
    );
    const rewritten = result.record.rewritten_thought;
    expect(rewritten).toBeDefined();
    expect(rewritten).toContain("\n");
    expect(rewritten).toContain("Second line with spaces.");
  });
});

describe("C7: review markdown honors the limit argument", () => {
  it("renders only the most recent thoughts when limited", () => {
    const engine = new UltraBrainEngine();
    for (let n = 1; n <= 5; n++) {
      engine.process(thought({ session_id: "s", thought_number: n, total_thoughts: 5 }));
    }
    const md = engine.review({ session_id: "s", format: "markdown", limit: 2 });
    const headerCount = (md.match(/^### /gm) ?? []).length;
    expect(headerCount).toBe(2);
  });
});

describe("export json with a limit keeps the transcript consistent", () => {
  it("does not leak branch records outside the limited window", () => {
    const engine = new UltraBrainEngine();
    engine.process(thought({ session_id: "s", thought_number: 1 }));
    engine.process(
      thought({ session_id: "s", thought_number: 2, branch_id: "b", branch_from_thought: 1 }),
    );
    for (const n of [3, 4, 5]) {
      engine.process(thought({ session_id: "s", thought_number: n }));
    }
    const parsed = JSON.parse(engine.export("s", "json", 2)) as {
      thoughts: unknown[];
      branches: Record<string, unknown[]>;
    };
    expect(parsed.thoughts).toHaveLength(2);
    expect(parsed.branches.b ?? []).toHaveLength(0);
  });
});
