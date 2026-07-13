// The write-back journal — the live half of the memory system.
//
// Booboo's snapshot is DERIVED (rebuilt by `booboo build`, gitignored). If live
// agent writes (remember/report) went into the snapshot, the next build would
// erase them. So they go into an append-only JSONL journal that sits BESIDE the
// snapshot but OUTSIDE it — `booboo build` rewrites brain.json and never touches
// brain.journal.jsonl. Every consumer (serve/mcp/panel) replays the journal at
// load, so a written memory is durable and immediately queryable.
//
// Append-only JSONL (one entry per line) is deliberate: appends are atomic on a
// single fd, there is no read-modify-write race, and a crash can at worst leave
// one torn trailing line — which the loader skips rather than losing the file.
import { appendFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join, basename } from "node:path";
import { randomUUID } from "node:crypto";
import type { BNode, BLink } from "@booboo-brain/spec";
import type { BoobooIndex } from "./graph.js";

/** One journal line: the node that was written + its spine link to a parent
 *  (matches the snapshot convention — reports `filed`, memories `recalls`). */
export type JournalEntry = { node: BNode; link?: BLink };

export type WriteInput = {
  /** the agent id this belongs to (org id, e.g. "writer"). Optional → roots at core. */
  agent?: string;
  /** the memory / report body — one atomic note, written for the next reader. */
  text: string;
  /** short display label; derived from `text` when absent. */
  title?: string;
  /** memory kind: decision|bugfix|pattern|config|discovery|context… (free text). */
  kind?: string;
  /** memory bucket (becomes the node's cluster) — groups the note under an agent/topic. */
  bucket?: string;
  /** report status: ok|warn|fail. */
  status?: string;
};

/** brain.json → brain.journal.jsonl (beside it, outside it). */
export function journalPathFor(snapshot: string): string {
  const dir = dirname(snapshot);
  const base = basename(snapshot).replace(/\.json$/i, "");
  return join(dir, `${base}.journal.jsonl`);
}

/** Read a JSONL journal into entries. Missing file → []. A torn/corrupt line is
 *  skipped with a stderr note — one bad line must never lose the whole memory. */
export function loadJournal(path: string): JournalEntry[] {
  if (!existsSync(path)) return [];
  const out: JournalEntry[] = [];
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const s = line.trim();
    if (!s) continue;
    try {
      const e = JSON.parse(s) as JournalEntry;
      if (e?.node?.id) out.push(e);
    } catch {
      console.error(`🐾 journal: skipped a corrupt line in ${path}`);
    }
  }
  return out;
}

/** Replay a journal into a live index so a served brain already carries every
 *  past write. Duplicate ids (a re-run replay) are skipped. Returns the count added. */
export function replayJournal(ix: BoobooIndex, path: string): number {
  let n = 0;
  for (const e of loadJournal(path)) if (ix.add(e.node, e.link)) n++;
  return n;
}

const LAYER_FOR = { memory: ["memory", "engram"], report: ["reports", "report"] } as const;

/** The write path behind booboo_remember / booboo_report. Holds the live index
 *  (for parent resolution + immediate query) and the journal path (for durability). */
export class JournalWriter {
  constructor(
    private ix: BoobooIndex,
    readonly path: string,
  ) {}

  /** Pick a real layer for this node type: prefer a declared one, else the first
   *  candidate (validate() only warns on an undeclared layer — the node still adds). */
  private layer(kind: "memory" | "report"): string {
    const have = new Set(this.ix.graph.meta.layers.map((l) => l.name));
    for (const w of LAYER_FOR[kind]) if (have.has(w)) return w;
    return LAYER_FOR[kind][0];
  }

  /** Resolve an agent id to its graph node, tolerating the prefix gotcha
   *  (org "writer" → graph "agent:writer"). Falls back to the graph root so a
   *  write is never orphaned. */
  private parentFor(agent?: string): string {
    const root = this.ix.graph.meta.root;
    if (!agent) return root;
    if (this.ix.node(agent)) return agent;
    if (this.ix.node(`agent:${agent}`)) return `agent:${agent}`;
    const hit = this.ix.search(agent, 1)[0];
    return hit ? hit.id : root;
  }

  private write(kind: "memory" | "report", inp: WriteInput): JournalEntry {
    const text = (inp.text ?? "").trim();
    if (!text) throw new Error(`${kind}: text is required`);
    const agent = inp.agent?.trim() || undefined;
    const parent = this.parentFor(agent);
    const cluster = inp.bucket?.trim() || agent || null;
    const id = `${kind === "report" ? "rep" : "mem"}:${agent ?? "core"}:${Date.now().toString(36)}:${randomUUID().slice(0, 4)}`;
    const label = (inp.title?.trim() || text).slice(0, 80);
    const at = new Date().toISOString();
    const data: Record<string, unknown> =
      kind === "report"
        ? { agent: agent ?? null, at, summary: text, status: inp.status ?? "ok" }
        : { agent: agent ?? null, at, text, kind: inp.kind ?? "context", bucket: cluster };
    const node: BNode = { id, type: kind, layer: this.layer(kind), label, weight: 0.2, tier: 3, parent, cluster, data };
    const link: BLink = { source: parent, target: id, type: kind === "report" ? "filed" : "recalls" };
    const entry: JournalEntry = { node, link };
    // Durable first (append-only), then live. If the append throws we never
    // mutate the index — a write the disk rejected must not appear queryable.
    mkdirSync(dirname(this.path), { recursive: true });
    appendFileSync(this.path, JSON.stringify(entry) + "\n", "utf8");
    this.ix.add(node, link);
    return entry;
  }

  remember(inp: WriteInput): JournalEntry {
    return this.write("memory", inp);
  }
  report(inp: WriteInput): JournalEntry {
    return this.write("report", inp);
  }
}
