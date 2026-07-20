import { describe, it, expect } from "vitest";
import { BoobooIndex } from "../src/graph.js";
import type { BoobooGraph } from "@booboo-brain/spec";

const g: BoobooGraph = {
  booboo: "1.0",
  meta: { root: "core", layers: [{ name: "a" }, { name: "b" }] },
  nodes: [
    { id: "core", type: "root", layer: "a", label: "Core", weight: 1 },
    { id: "x", type: "agent", layer: "a", label: "Alpha", weight: 0.6, cluster: "t1" },
    { id: "y", type: "memory", layer: "b", label: "Alphabet soup", weight: 0.2, cluster: "t1" },
    { id: "z", type: "memory", layer: "b", label: "Zeta", weight: 0.2, cluster: "t2" },
  ],
  links: [
    { source: "core", target: "x", type: "spine" },
    { source: "x", target: "y", type: "recalls" },
    { source: "core", target: "ghost", type: "broken" }, // dangling — ignored
  ],
};
const ix = new BoobooIndex(g);

describe("BoobooIndex", () => {
  it("counts by layer and total", () => {
    // links: 2 — the core→ghost link is dangling and excluded (3 links defined, 1 dropped)
    expect(ix.counts()).toEqual({ nodes: 4, links: 2, byLayer: { a: 2, b: 2 } });
  });

  it("lists with filters + paging", () => {
    expect(ix.list({ layer: "b" }).total).toBe(2);
    expect(ix.list({ cluster: "t1" }).total).toBe(2);
    expect(ix.list({ type: "memory", limit: 1 }).nodes).toHaveLength(1);
  });

  // GAPS C33. `type=memory` has to answer for BOTH stored conventions: nodes
  // the JournalWriter writes as `memory`, and ledger entries the generators
  // write as `observation`. It was a rename in one caller (the demo site's
  // adapter) and absent everywhere else, so `booboo panel` read 0 memories over
  // a snapshot holding 2,100. Both directions are pinned here because the first
  // fix widened one and broke the other.
  it("type=memory matches both `memory` and `observation` nodes", () => {
    const mixed = new BoobooIndex({
      booboo: "1.0",
      meta: { root: "core", layers: [{ name: "a" }] },
      nodes: [
        { id: "core", type: "root", layer: "a", label: "Core", weight: 1 },
        { id: "j", type: "memory", layer: "a", label: "journal note", weight: 0.2, cluster: "house" },
        { id: "o", type: "observation", layer: "a", label: "ledger entry", weight: 0.2, cluster: "house" },
      ],
      links: [],
    });
    expect(mixed.list({ type: "memory" }).total).toBe(2);
    // and the literal type still selects only itself — the alias is one-way
    expect(mixed.list({ type: "observation" }).total).toBe(1);
    expect(mixed.clusters("memory")).toEqual({ house: 2 });
    expect(mixed.count({ type: "memory" }).total).toBe(2);
  });

  it("ranks search exact > prefix > substring", () => {
    const r = ix.search("alpha");
    expect(r[0].id).toBe("x"); // "Alpha" exact beats "Alphabet soup" substring
    expect(r.map((n) => n.id)).toContain("y");
  });

  it("walks neighbours by depth, dropping dangling links", () => {
    const n1 = ix.neighbors("core", 1);
    expect(n1.nodes.map((n) => n.id)).toEqual(["x"]); // ghost link skipped
    const n2 = ix.neighbors("core", 2);
    expect(n2.nodes.map((n) => n.id).sort()).toEqual(["x", "y"]);
  });

  it("finds shortest path and returns null when unreachable", () => {
    expect(ix.path("core", "y")!.map((n) => n.id)).toEqual(["core", "x", "y"]);
    expect(ix.path("core", "z")).toBeNull(); // z is isolated
    expect(ix.path("core", "nope")).toBeNull();
  });

  it("refuses to index a graph with duplicate node ids", () => {
    const dup: BoobooGraph = {
      booboo: "1.0",
      meta: { root: "core", layers: [{ name: "a" }] },
      nodes: [
        { id: "core", type: "root", layer: "a", label: "Core", weight: 1 },
        { id: "x", type: "agent", layer: "a", label: "First", weight: 0.5 },
        { id: "x", type: "agent", layer: "a", label: "Second", weight: 0.5 }, // duplicate id
      ],
      links: [],
    };
    expect(() => new BoobooIndex(dup)).toThrow(/duplicate node id/);
  });
});
