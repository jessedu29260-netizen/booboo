import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync, appendFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BoobooIndex } from "../src/graph.js";
import { JournalWriter, replayJournal, journalPathFor, loadJournal } from "../src/journal.js";
import type { BoobooGraph } from "@booboo-brain/spec";

const fresh = (): BoobooGraph => ({
  booboo: "1.0",
  meta: { root: "core", layers: [{ name: "agents" }, { name: "memory" }, { name: "reports" }] },
  nodes: [
    { id: "core", type: "root", layer: "agents", label: "Core", weight: 1 },
    { id: "agent:writer", type: "agent", layer: "agents", label: "Writer", weight: 0.6 },
  ],
  links: [{ source: "core", target: "agent:writer", type: "spine" }],
});

let dir: string;
let jp: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "booboo-j-"));
  jp = journalPathFor(join(dir, "brain.json"));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("JournalWriter", () => {
  it("writes a memory that is immediately queryable + linked to its agent", () => {
    const ix = new BoobooIndex(fresh());
    const w = new JournalWriter(ix, jp);
    const { node, link } = w.remember({ agent: "writer", text: "shipped write-back", bucket: "eng" });
    expect(node.type).toBe("memory");
    expect(node.layer).toBe("memory");
    expect(node.parent).toBe("agent:writer"); // prefix gotcha resolved (writer → agent:writer)
    expect(node.cluster).toBe("eng");
    expect(link).toEqual({ source: "agent:writer", target: node.id, type: "recalls" });
    // live in the same index
    expect(ix.node(node.id)?.id).toBe(node.id);
    expect(ix.search("shipped write-back")[0]?.id).toBe(node.id);
    expect(ix.neighbors("agent:writer", 1, 100).nodes.some((n) => n.id === node.id)).toBe(true);
  });

  it("files a report with the filed link + status default", () => {
    const ix = new BoobooIndex(fresh());
    const { node, link } = new JournalWriter(ix, jp).report({ agent: "writer", text: "closed the loop" });
    expect(node.type).toBe("report");
    expect((node.data as { status: string }).status).toBe("ok");
    expect(link?.type).toBe("filed");
  });

  it("roots at the graph root when the agent can't be resolved", () => {
    const ix = new BoobooIndex(fresh());
    const { node } = new JournalWriter(ix, jp).remember({ agent: "nobody", text: "orphan-proof" });
    expect(node.parent).toBe("core");
  });

  it("rejects empty text (trust boundary) and writes nothing", () => {
    const ix = new BoobooIndex(fresh());
    const w = new JournalWriter(ix, jp);
    expect(() => w.remember({ text: "   " })).toThrow(/text is required/);
    expect(existsSync(jp)).toBe(false); // nothing appended
  });

  it("is durable: a rebuilt index replays every write, idempotently", () => {
    const ix = new BoobooIndex(fresh());
    const w = new JournalWriter(ix, jp);
    const a = w.remember({ agent: "writer", text: "fact one" });
    const b = w.report({ agent: "writer", text: "did a thing" });
    // simulate `booboo build` regenerating brain.json (fresh graph), then serve replaying
    const rebuilt = new BoobooIndex(fresh());
    expect(replayJournal(rebuilt, jp)).toBe(2);
    expect(rebuilt.node(a.node.id)?.id).toBe(a.node.id);
    expect(rebuilt.node(b.node.id)?.id).toBe(b.node.id);
    // replaying again adds nothing (ids already present)
    expect(replayJournal(rebuilt, jp)).toBe(0);
  });

  it("skips a torn/corrupt journal line instead of losing the file", () => {
    const ix = new BoobooIndex(fresh());
    const w = new JournalWriter(ix, jp);
    w.remember({ agent: "writer", text: "good line" });
    // append a torn trailing line (a crash mid-write)
    appendFileSync(jp, '{"node":{"id":"broken"', "utf8");
    const entries = loadJournal(jp);
    expect(entries.length).toBe(1); // the good one survives; the torn line is skipped
  });
});
