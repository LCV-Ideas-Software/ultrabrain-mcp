import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  SERVER_HOMEPAGE,
  SERVER_LICENSE,
  SERVER_NAME,
  SERVER_PUBLISHER,
  SERVER_RELEASE_DATE,
  SERVER_SPONSORS_URL,
  SERVER_VERSION,
} from "../src/meta.js";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as Record<
  string,
  string
>;
const changelog = readFileSync(new URL("../CHANGELOG.md", import.meta.url), "utf8");

describe("meta constants stay in lockstep with the package manifest", () => {
  it("matches the package version", () => {
    expect(SERVER_VERSION).toBe(pkg.version);
  });

  it("matches the package name suffix", () => {
    expect(pkg.name.endsWith(`/${SERVER_NAME}`)).toBe(true);
  });

  it("matches author, license, and homepage", () => {
    expect(SERVER_PUBLISHER).toBe(pkg.author);
    expect(SERVER_LICENSE).toBe(pkg.license);
    expect(SERVER_HOMEPAGE).toBe(pkg.homepage);
  });

  it("uses the project-scoped central sponsor page", () => {
    expect(SERVER_SPONSORS_URL).toBe(`https://www.lcv.dev/sponsor/?project=${SERVER_NAME}`);
  });

  it("uses an ISO release date", () => {
    expect(SERVER_RELEASE_DATE).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("matches the first versioned CHANGELOG heading", () => {
    const head = changelog.match(/^## (\d+\.\d+\.\d+) - (.+)$/m);
    expect(head?.[1]).toBe(SERVER_VERSION);
    expect(head?.[2]).toBe(SERVER_RELEASE_DATE);
  });
});
