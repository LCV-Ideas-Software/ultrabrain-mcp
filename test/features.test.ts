import { describe, expect, it } from "vitest";
import { UltraBrainEngine } from "../src/engine.js";
import { thought } from "./helpers.js";

describe("F7: review renders a Mermaid graph of the thought structure", () => {
  it("emits a graph TD with the main chain and a branch edge", () => {
    const engine = new UltraBrainEngine();
    engine.process(thought({ session_id: "s", thought_number: 1 }));
    engine.process(thought({ session_id: "s", thought_number: 2 }));
    engine.process(
      thought({ session_id: "s", thought_number: 3, branch_id: "alt", branch_from_thought: 2 }),
    );

    const graph = engine.review({ session_id: "s", format: "mermaid" });
    expect(graph).toContain("graph TD");
    expect(graph).toMatch(/T1 --> T2/);
    expect(graph.toLowerCase()).toContain("alt");
  });
});

describe("F10: validate reports template stage coverage", () => {
  it("lists declared template stages that no thought covers", () => {
    const engine = new UltraBrainEngine();
    engine.start({ session_id: "t", problem: "trace a defect", template: "bug_analysis" });
    engine.process(thought({ session_id: "t", thought_number: 1, tags: ["symptom"] }));

    const result = engine.validate({ session_id: "t", response_format: "json" }) as {
      template_coverage?: { template: string; covered: string[]; uncovered: string[] };
    };
    expect(result.template_coverage?.template).toBe("bug_analysis");
    expect(result.template_coverage?.covered).toContain("symptom");
    expect(result.template_coverage?.uncovered).toContain("regression_guard");
  });

  it("omits template coverage when the session has no template", () => {
    const engine = new UltraBrainEngine();
    engine.process(thought({ session_id: "n", thought_number: 1 }));
    const result = engine.validate({ session_id: "n", response_format: "json" }) as {
      template_coverage?: unknown;
    };
    expect(result.template_coverage).toBeUndefined();
  });
});

describe("F12: process surfaces related prior thoughts", () => {
  it("links an earlier thought that shares a tag and step type", () => {
    const engine = new UltraBrainEngine();
    engine.process(
      thought({ session_id: "s", thought_number: 1, step_type: "analysis", tags: ["auth"] }),
    );
    const result = engine.process(
      thought({ session_id: "s", thought_number: 2, step_type: "analysis", tags: ["auth"] }),
    );
    const related = result.related_thoughts ?? [];
    expect(related.some((r) => r.thought_number === 1 && r.shared_tags.includes("auth"))).toBe(
      true,
    );
  });

  it("does not relate a thought to itself", () => {
    const engine = new UltraBrainEngine();
    const result = engine.process(
      thought({ session_id: "s", thought_number: 1, step_type: "analysis", tags: ["auth"] }),
    );
    const related = result.related_thoughts ?? [];
    expect(related.every((r) => r.thought_number !== 1)).toBe(true);
  });
});
