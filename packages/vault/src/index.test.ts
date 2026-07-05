import { describe, it, expect } from "vitest";
import { mkdtempSync, readFileSync, existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { BoobooGraph, BOrg } from "@booboo-brain/spec";
import { emitVault } from "./index.js";

const graph: BoobooGraph = {
  booboo: "1.0",
  meta: { root: "hq", title: "test brain", layers: [{ name: "hq" }, { name: "memory" }] },
  nodes: [
    { id: "hq", type: "root", layer: "hq", label: "HQ", parent: null },
    { id: "mem:a", type: "memory", layer: "memory", label: "note A", cluster: "shared", data: { at: "2026-07-01T00:00:00Z" } },
    { id: "mem:b", type: "memory", layer: "memory", label: "note B", cluster: "shared" },
  ],
  links: [
    { source: "hq", target: "mem:a", type: "spine" },
    { source: "mem:a", target: "mem:b", type: "authored" },
  ],
};

const org: BOrg = {
  booboo_org: "1.0",
  root: "hq",
  agents: [
    { id: "hq", name: "HQ", rules: ["rules/GLOBAL.md"], buckets: ["shared"] },
    { id: "worker", name: "Worker", parent: "hq" },
    { id: "bot", name: "Bot", parent: "worker", kind: "automation", boot: "run the thing" },
  ],
};

describe("emitVault", () => {
  it("emits node pages, MOCs, org dossiers and a root index with resolvable wikilinks", () => {
    const out = mkdtempSync(join(tmpdir(), "booboo-vault-"));
    const r = emitVault(graph, org, { out });
    expect(r.pages).toBeGreaterThan(5);
    expect(r.agents).toBe(3);

    // root index links the layers + the org
    const index = readFileSync(join(out, "index.md"), "utf8");
    expect(index).toContain("[[memory/_index|memory]]");
    expect(index).toContain("[[org/_index|organigram]]");

    // node page carries frontmatter + authored link (deliberate links first)
    const a = readFileSync(join(out, "memory", "shared", "mem-a.md"), "utf8");
    expect(a).toContain('id: "mem:a"');
    expect(a).toContain("[[mem-b|note B]] *(authored)*");

    // worker dossier shows the inherited rule + its machine
    const w = readFileSync(join(out, "org", "worker.md"), "utf8");
    expect(w).toContain("rules/GLOBAL.md");
    expect(w).toContain("[[org/bot|Bot]]");

    // clean=true wipes stale pages on re-emit
    const r2 = emitVault(graph, org, { out });
    expect(r2.pages).toBe(r.pages);
    expect(existsSync(join(out, "index.md"))).toBe(true);
    expect(readdirSync(out).length).toBeGreaterThan(0);
  });
});
