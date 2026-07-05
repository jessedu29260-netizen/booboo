// Booboo vault — the brain as plain, wiki-linked markdown (Obsidian-compatible).
//
// Same snapshot the viewer renders, emitted as files: one page per node, MOC
// index pages per layer and cluster, agent dossiers from the org. Why it exists:
// a database is queryable, files are READABLE and PORTABLE — a human can browse
// the brain on a couch, and any future agent (any provider) can read it with
// zero infrastructure. Emit it nightly and the vault doubles as insurance.
//
// Obsidian resolves [[wikilinks]] by FILENAME, so every node gets a unique,
// filesystem-safe page name; links use the alias form [[page|label]].

import { mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { BoobooGraph, BNode, BLink, BOrg } from "@booboo-brain/spec";
import { orgBootSlice } from "@booboo-brain/spec";

export type VaultOptions = {
  out: string;
  /** wipe the output dir first (default true — the vault is a derived artifact) */
  clean?: boolean;
  /** cap per-cluster node pages (0 = no cap; default 0). MOCs always list everything. */
  maxPerCluster?: number;
};

export type VaultResult = { dir: string; pages: number; layers: number; agents: number };

const safe = (s: string): string => s.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120) || "x";

// timestamps vary by adapter — same fallback chain the panel uses
function nodeAt(n: BNode): string {
  const d = (n.data ?? {}) as Record<string, unknown>;
  for (const k of ["at", "ts", "time", "created_at", "date", "bst", "ts_bst", "finished_at"]) {
    const v = d[k];
    if (typeof v === "string" && v) return v;
  }
  return "";
}

const fm = (kv: Record<string, unknown>): string =>
  "---\n" +
  Object.entries(kv)
    .filter(([, v]) => v != null && v !== "")
    .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
    .join("\n") +
  "\n---\n\n";

/** Emit `graph` (+ optional `org`) as a markdown vault. Pure filesystem writer. */
export function emitVault(graph: BoobooGraph, org: BOrg | undefined, opts: VaultOptions): VaultResult {
  const out = opts.out;
  if ((opts.clean ?? true) && existsSync(out)) rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });

  // unique page name per node id (collisions get a numeric suffix)
  const pageOf = new Map<string, string>();
  const used = new Set<string>();
  for (const n of graph.nodes) {
    let p = safe(n.id);
    let i = 2;
    while (used.has(p)) p = `${safe(n.id)}-${i++}`;
    used.add(p);
    pageOf.set(n.id, p);
  }

  // adjacency (both directions — a page lists everything it touches)
  const linksOf = new Map<string, { other: string; type: string; out: boolean }[]>();
  const push = (id: string, e: { other: string; type: string; out: boolean }) => {
    const arr = linksOf.get(id) ?? [];
    arr.push(e);
    linksOf.set(id, arr);
  };
  for (const l of graph.links as BLink[]) {
    push(l.source, { other: l.target, type: l.type, out: true });
    push(l.target, { other: l.source, type: l.type, out: false });
  }

  const label = new Map(graph.nodes.map((n) => [n.id, n.label || n.id]));
  const wiki = (id: string): string => {
    const p = pageOf.get(id);
    return p ? `[[${p}|${(label.get(id) ?? id).replace(/[|\[\]]/g, " ")}]]` : id;
  };

  let pages = 0;
  const write = (rel: string, body: string) => {
    const f = join(out, rel);
    mkdirSync(join(f, ".."), { recursive: true });
    writeFileSync(f, body, "utf8");
    pages++;
  };

  // group: layer → cluster → nodes
  const byLayer = new Map<string, Map<string, BNode[]>>();
  for (const n of graph.nodes) {
    const lay = byLayer.get(n.layer) ?? new Map<string, BNode[]>();
    const cl = n.cluster ?? "_";
    const arr = lay.get(cl) ?? [];
    arr.push(n);
    lay.set(cl, arr);
    byLayer.set(n.layer, lay);
  }

  // ── node pages ─────────────────────────────────────────────────────────────
  const LINK_ORDER = ["authored", "spine"]; // deliberate links first, structure second, the rest after
  for (const [layer, clusters] of byLayer) {
    for (const [cluster, nodes] of clusters) {
      const capped = opts.maxPerCluster ? nodes.slice(0, opts.maxPerCluster) : nodes;
      for (const n of capped) {
        const at = nodeAt(n);
        const rels = (linksOf.get(n.id) ?? []).sort(
          (a, b) =>
            (LINK_ORDER.indexOf(a.type) + 1 || 99) - (LINK_ORDER.indexOf(b.type) + 1 || 99) || a.type.localeCompare(b.type),
        );
        const dataLines = Object.entries(n.data ?? {})
          .filter(([, v]) => v != null && v !== "" && typeof v !== "object")
          .map(([k, v]) => `- **${k}**: ${String(v).slice(0, 2000)}`);
        const relLines = rels
          .slice(0, 200)
          .map((r) => `- ${r.out ? "→" : "←"} ${wiki(r.other)} *(${r.type})*`);
        write(
          join(safe(layer), safe(cluster), pageOf.get(n.id) + ".md"),
          fm({ id: n.id, type: n.type, layer: n.layer, cluster: n.cluster ?? undefined, weight: n.weight, at: at || undefined }) +
            `# ${n.label || n.id}\n\n` +
            (dataLines.length ? dataLines.join("\n") + "\n\n" : "") +
            (relLines.length ? `## links\n\n${relLines.join("\n")}\n` : ""),
        );
      }
    }
  }

  // ── cluster + layer MOCs ───────────────────────────────────────────────────
  for (const [layer, clusters] of byLayer) {
    const clusterLines: string[] = [];
    for (const [cluster, nodes] of clusters) {
      const sorted = [...nodes].sort((a, b) => nodeAt(b).localeCompare(nodeAt(a)));
      write(
        join(safe(layer), safe(cluster), "_index.md"),
        fm({ moc: true, layer, cluster }) +
          `# ${cluster} · ${layer}\n\n${nodes.length} pages\n\n` +
          sorted.map((n) => `- ${wiki(n.id)}${nodeAt(n) ? ` — ${nodeAt(n).slice(0, 10)}` : ""}`).join("\n") +
          "\n",
      );
      clusterLines.push(`- [[${safe(layer)}/${safe(cluster)}/_index|${cluster}]] — ${nodes.length}`);
    }
    write(
      join(safe(layer), "_index.md"),
      fm({ moc: true, layer }) + `# ${layer}\n\n` + clusterLines.sort().join("\n") + "\n",
    );
  }

  // ── org / agent dossiers ───────────────────────────────────────────────────
  let agents = 0;
  if (org) {
    for (const a of org.agents) {
      const slice = orgBootSlice(org, a.id);
      if (!slice) continue;
      const machines = org.agents.filter((m) => m.parent === a.id && m.kind === "automation");
      const kids = slice.children.filter((c) => c.kind !== "automation");
      write(
        join("org", safe(a.id) + ".md"),
        fm({ id: a.id, kind: a.kind ?? "agent", role: a.role ?? undefined }) +
          `# ${a.emoji ? a.emoji + " " : ""}${a.name}\n\n` +
          (a.role ? `*${a.role}*\n\n` : "") +
          `**chain**: ${slice.chain.map((c) => `[[org/${safe(c.id)}|${c.name}]]`).join(" › ")}\n\n` +
          (slice.rules.length ? `## rules (inherited top-down)\n\n${slice.rules.map((r) => `- ${r}`).join("\n")}\n\n` : "") +
          (slice.buckets.length ? `## memory buckets\n\n${slice.buckets.map((b) => `- ${b}`).join("\n")}\n\n` : "") +
          (kids.length ? `## reports to this agent\n\n${kids.map((c) => `- [[org/${safe(c.id)}|${c.name}]]`).join("\n")}\n\n` : "") +
          (machines.length ? `## machines\n\n${machines.map((m) => `- [[org/${safe(m.id)}|${m.name}]]${m.role ? ` — ${m.role}` : ""}`).join("\n")}\n\n` : "") +
          (a.boot ? `## contract\n\n\`\`\`\n${a.boot}\n\`\`\`\n` : ""),
      );
      agents++;
    }
    write(
      join("org", "_index.md"),
      fm({ moc: true }) +
        `# ${org.title ?? "the organigram"}\n\n` +
        org.agents
          .filter((a) => a.kind !== "automation")
          .map((a) => `- [[org/${safe(a.id)}|${a.emoji ? a.emoji + " " : ""}${a.name}]]${a.role ? ` — ${a.role}` : ""}`)
          .join("\n") +
        "\n",
    );
  }

  // ── root index ─────────────────────────────────────────────────────────────
  const layerLines = [...byLayer.entries()].map(
    ([layer, clusters]) =>
      `- [[${safe(layer)}/_index|${layer}]] — ${[...clusters.values()].reduce((s, ns) => s + ns.length, 0)} pages · ${clusters.size} clusters`,
  );
  write(
    "index.md",
    fm({ booboo: graph.booboo, root: graph.meta.root, generated: graph.meta.generated ?? undefined }) +
      `# ${graph.meta.title ?? "the brain"}\n\n` +
      `${graph.nodes.length.toLocaleString()} nodes · ${graph.links.length.toLocaleString()} links\n\n` +
      (org ? `**the fleet**: [[org/_index|organigram]] — ${org.agents.length} agents\n\n` : "") +
      `## layers\n\n${layerLines.join("\n")}\n`,
  );

  return { dir: out, pages, layers: byLayer.size, agents };
}
