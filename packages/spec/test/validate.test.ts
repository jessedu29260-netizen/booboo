import { describe, it, expect } from "vitest";
import { validate } from "../src/index.js";

const ok = { booboo: "1.0", meta: { root: "a", layers: [{ name: "x" }] }, nodes: [{ id: "a", type: "r", layer: "x", label: "A" }], links: [] };

describe("validate", () => {
  it("passes a minimal valid graph", () => {
    const r = validate(ok);
    expect(r.ok).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it("errors on missing root, duplicate id, and root-not-a-node", () => {
    expect(validate({ meta: {}, nodes: [], links: [] }).ok).toBe(false);

    const dup = validate({ ...ok, nodes: [ok.nodes[0], { id: "a", type: "r", layer: "x", label: "A2" }] });
    expect(dup.ok).toBe(false);
    expect(dup.errors.some((e) => e.includes("duplicate"))).toBe(true);

    const noRoot = validate({ ...ok, meta: { root: "z", layers: [{ name: "x" }] } });
    expect(noRoot.errors.some((e) => e.includes("not a node id"))).toBe(true);
  });

  it("warns (not errors) on dangling links, and never throws", () => {
    const r = validate({ ...ok, links: [{ source: "a", target: "ghost", type: "t" }] });
    expect(r.ok).toBe(true);
    expect(r.warnings.some((w) => w.includes("missing nodes"))).toBe(true);

    expect(() => validate(null)).not.toThrow();
    expect(validate(null).ok).toBe(false);
  });
});
