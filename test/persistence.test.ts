import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { UltraBrainEngine } from "../src/engine.js";
import { thought } from "./helpers.js";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "ub-persist-"));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("A1: branch/thought record identity survives a persisted restart", () => {
  it("updates via branch_id are visible in the main thoughts view after reload", () => {
    let engine = new UltraBrainEngine({ persistence_dir: dir });
    engine.process(thought({ session_id: "s", thought_number: 1 }));
    engine.process(
      thought({
        session_id: "s",
        thought_number: 2,
        branch_id: "alt",
        branch_from_thought: 1,
      }),
    );

    // Simulate a host reload: fresh engine over the same state dir.
    engine = new UltraBrainEngine({ persistence_dir: dir });
    engine.update({
      session_id: "s",
      thought_number: 2,
      branch_id: "alt",
      evidence: ["fresh proof after reload"],
    });

    const history = engine.history("s", 50) as {
      thoughts: Array<{ thought_number: number; evidence?: string[] }>;
    };
    const mainRecord = history.thoughts.find((t) => t.thought_number === 2);
    expect(mainRecord?.evidence).toEqual(["fresh proof after reload"]);
  });
});

describe("A2: corrupt session files are quarantined, not silently ignored", () => {
  it("renames an unparseable .json file and still starts", () => {
    writeFileSync(join(dir, "broken.json"), "{ this is not valid json", "utf8");
    const engine = new UltraBrainEngine({ persistence_dir: dir });
    expect(engine).toBeDefined();
    const files = readdirSync(dir);
    expect(files.some((f) => f.startsWith("broken.json.corrupt-"))).toBe(true);
    expect(files.includes("broken.json")).toBe(false);
  });

  it("leaves no .tmp file behind after a normal persist", () => {
    const engine = new UltraBrainEngine({ persistence_dir: dir });
    engine.process(thought({ session_id: "s", thought_number: 1 }));
    const files = readdirSync(dir);
    expect(files.some((f) => f.endsWith(".tmp"))).toBe(false);
    expect(files.includes("s.json")).toBe(true);
  });
});

describe("B4: files whose internal id does not match their filename do not resurrect as phantom sessions", () => {
  it("quarantines a mismatched file instead of loading a phantom id", () => {
    const bogus = {
      id: "realid",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      status: "active",
      tags: [],
      thoughts: [],
      branches: {},
      merged_branches: {},
    };
    writeFileSync(join(dir, "wrongname.json"), JSON.stringify(bogus), "utf8");

    const engine = new UltraBrainEngine({ persistence_dir: dir });
    const status = engine.status("realid") as { status: string };
    expect(status.status).toBe("empty");
    const files = readdirSync(dir);
    expect(files.some((f) => f.startsWith("wrongname.json.corrupt-"))).toBe(true);
  });
});

describe("B10: reset all_sessions only deletes files the engine created", () => {
  it("preserves foreign .json files in the state dir", () => {
    const engine = new UltraBrainEngine({ persistence_dir: dir });
    engine.process(thought({ session_id: "a", thought_number: 1 }));
    writeFileSync(join(dir, "notes.json"), '{"note":true}', "utf8");

    engine.reset("default", true);

    const files = readdirSync(dir);
    expect(files.includes("notes.json")).toBe(true);
    expect(files.includes("a.json")).toBe(false);
  });
});

describe("C2: malformed thought records inside an otherwise-valid session are rejected on load", () => {
  it("does not load a session whose thoughts array contains non-conforming records", () => {
    const malformed = {
      id: "m",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      status: "active",
      tags: [],
      thoughts: [{ thought_number: 1 }],
      branches: {},
      merged_branches: {},
    };
    writeFileSync(join(dir, "m.json"), JSON.stringify(malformed), "utf8");

    const engine = new UltraBrainEngine({ persistence_dir: dir });
    const status = engine.status("m") as { status: string };
    expect(status.status).toBe("empty");
  });
});

describe("persisted files remain valid JSON", () => {
  it("round-trips a session", () => {
    const engine = new UltraBrainEngine({ persistence_dir: dir });
    engine.process(thought({ session_id: "s", thought_number: 1 }));
    const raw = readFileSync(join(dir, "s.json"), "utf8");
    expect(() => JSON.parse(raw)).not.toThrow();
  });
});
