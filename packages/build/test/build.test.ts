import { describe, it, expect } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "../src/build.js";
import type { BoobooConfig } from "../src/config.js";

const dir = path.dirname(fileURLToPath(import.meta.url));

describe("build (json adapter + engine)", () => {
  it("merges a json source, auto-wires parent spines, drops dangling, applies walls", async () => {
    const cfg: BoobooConfig = {
      title: "T",
      root: { id: "core", type: "root", label: "ROOT", layer: "a" },
      layers: [{ name: "a" }, { name: "b" }],
      walls: ["secret"],
      sources: [{ adapter: "json", path: "fixture.booboo.json" }],
    };
    const g = await build(cfg, dir);
    const ids = g.nodes.map((n) => n.id);
    expect(ids).toContain("core"); // root added
    expect(ids).toContain("n1");
    expect(ids).not.toContain("n2"); // walled (cluster=secret) → never emitted
    expect(ids).not.toContain("n3"); // walled via wall_field marker (data.__wall=secret) → never emitted
    expect(ids).toContain("n4"); // data.__wall=open is not walled → kept
    // the build-time-only marker must never leak into emitted node.data
    expect(g.nodes.every((n) => !(n.data && "__wall" in n.data))).toBe(true);
    expect(g.links.some((l) => l.source === "core" && l.target === "n1" && l.type === "spine")).toBe(true); // spine auto-wired
    expect(g.links.some((l) => l.target === "ghost")).toBe(false); // dangling dropped
    expect(g.meta.counts!.nodes).toBe(g.nodes.length);
  });
});
