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
