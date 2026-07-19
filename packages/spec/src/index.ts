// Booboo graph spec (v1) — the entire contract. Keep it small. See ../../../SPEC.md.

export type BLayer = { name: string; color?: string; label?: string };

export type BMeta = {
  root: string;
  title?: string;
  layers: BLayer[];
  generated?: string;
  counts?: { nodes: number; links: number };
  /** ingestion-quality stats the builder computes (all optional, non-breaking):
   *  orphans = non-root nodes with no non-spine link · authored = deliberate
   *  [[wikilink]] edges · dumps = nodes carrying a text blob that looks like a
   *  transcript dump instead of an atomic note. Curation needs a number. */
  quality?: { orphans: number; authored: number; dumps: number };
};

export type BNode = {
  id: string;
  type: string;
  layer: string;
  label: string;
  weight?: number;
  tier?: number;
  parent?: string | null;
  cluster?: string | null;
  color?: string | null;
  icon?: string | null;
  x?: number | null;
  y?: number | null;
  z?: number | null;
  data?: Record<string, unknown>;
};

export type BLink = {
  source: string;
  target: string;
  type: string;
  weight?: number;
  color?: string | null;
};

export type BoobooGraph = {
  booboo: string;
  meta: BMeta;
  nodes: BNode[];
  links: BLink[];
};

export type ValidateResult = { ok: boolean; errors: string[]; warnings: string[] };

/** Validate a Booboo graph. Never throws. Dangling links / unknown layers are warnings (the
 *  builder drops them), missing required fields are errors. */
export function validate(g: unknown): ValidateResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const o = g as Partial<BoobooGraph>;
  if (!o || typeof o !== "object") return { ok: false, errors: ["graph is not an object"], warnings };
  if (!o.meta?.root) errors.push("meta.root is required");
  if (!Array.isArray(o.nodes)) errors.push("nodes[] is required");
  if (!Array.isArray(o.links)) errors.push("links[] is required");
  if (errors.length) return { ok: false, errors, warnings };

  const layers = new Set((o.meta!.layers ?? []).map((l) => l.name));
  if (layers.size === 0) warnings.push("meta.layers is empty — nodes will all share one plane");

  const ids = new Set<string>();
  for (const n of o.nodes!) {
    if (!n || typeof n !== "object") { errors.push("a node is not an object"); continue; }
    if (!n.id) { errors.push("a node is missing 'id'"); continue; }
    if (ids.has(n.id)) errors.push(`duplicate node id: ${n.id}`);
    ids.add(n.id);
    if (!n.type) warnings.push(`node '${n.id}' is missing 'type' (required by spec)`);
    if (!n.label) warnings.push(`node '${n.id}' is missing 'label' (required by spec)`);
    if (n.weight != null && (n.weight < 0 || n.weight > 1)) warnings.push(`node '${n.id}' weight ${n.weight} is outside [0,1]`);
    if (!n.layer || !layers.has(n.layer)) warnings.push(`node '${n.id}' layer '${n.layer}' is not in meta.layers`);
  }
  if (!ids.has(o.meta!.root)) errors.push(`meta.root '${o.meta!.root}' is not a node id`);

  let dangling = 0;
  for (const l of o.links!) {
    if (!l || typeof l !== "object") { errors.push("a link is not an object"); continue; }
    if (!ids.has(l.source) || !ids.has(l.target)) dangling++;
  }
  if (dangling) warnings.push(`${dangling} link(s) reference missing nodes (the builder drops these)`);

  return { ok: errors.length === 0, errors, warnings };
}

export const SPEC_VERSION = "1.0";

// ── The ORGANIGRAM (org spec v1) ─────────────────────────────────────────────
// The editable half of Booboo. A graph snapshot is derived and read-only; the
// org file is a SOURCE — the panel edits it, git diffs it, and agents boot
// from it (booboo_boot). Drag an agent under a new parent in the panel and,
// on apply, this file changes — next boot, every agent obeys the new shape.

export type BOrgAgent = {
  id: string; // unique slug
  name: string;
  role?: string; // one-liner shown on the card
  emoji?: string;
  parent?: string | null; // null/absent on the root only
  kind?: "agent" | "automation"; // automation = a machine its parent OPERATES —
  // it inherits rules/buckets like anything else (booboo_boot works), but it is
  // not an org unit: charts render it compactly on its owner, not as a card.
  cadence?: number; // expected HOURS between reports — for ANY agent, not just
  // automations. A department that reports daily is 24; one that reports weekly
  // is 168; a board that reviews monthly is 720. Health is recency-weighted off
  // the LATEST report: red only if it failed · amber if it was a warn or silence
  // passes ~2× cadence · green if ok and fresh. Older failures in the window
  // never tint a light — at most an "instability" accent.
  //
  // OMITTING THIS IS A DECISION, NOT A DEFAULT. Consumers fall back to ~26h,
  // which is a machine's rhythm; judging a weekly department by it turns the
  // board amber for no reason, and a board where everything is amber cannot
  // show you the one thing that is wrong. Declare the real rhythm.
  boot?: string; // boot prompt (inline text or a ref the runner resolves)
  rules?: string[]; // rule refs (file paths / ids) — inherited down the tree
  skills?: string[];
  buckets?: string[]; // memory buckets this agent reads/writes
  /** @deprecated Nothing reads this. Reports are found by agent id in the
   *  journal (`booboo_report` → `data.agent` / cluster), so a per-agent stream
   *  ref is a second way to say the same thing — and the one that isn't wired.
   *  Kept only because the type is published; remove at the next major. */
  reports?: string;
  data?: Record<string, unknown>;
};

export type BOrg = {
  booboo_org: string; // "1.0"
  title?: string;
  root: string; // id of the root agent
  agents: BOrgAgent[];
  updated?: string;
};

/** Validate an organigram. Never throws. Cycles and broken parents are errors —
 *  an org an agent can't safely boot from must never be written to disk. */
export function validateOrg(o: unknown): ValidateResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const g = o as Partial<BOrg>;
  if (!g || typeof g !== "object") return { ok: false, errors: ["org is not an object"], warnings };
  if (!g.root) errors.push("root is required");
  if (!Array.isArray(g.agents)) errors.push("agents[] is required");
  if (errors.length) return { ok: false, errors, warnings };

  const byId = new Map<string, BOrgAgent>();
  for (const a of g.agents!) {
    if (!a || typeof a !== "object") { errors.push("an agent is not an object"); continue; }
    if (!a.id) { errors.push("an agent is missing 'id'"); continue; }
    if (byId.has(a.id)) errors.push(`duplicate agent id: ${a.id}`);
    byId.set(a.id, a);
    if (!a.name) warnings.push(`agent '${a.id}' has no name`);
  }
  const root = byId.get(g.root!);
  if (!root) errors.push(`root '${g.root}' is not an agent id`);
  else if (root.parent) errors.push(`root '${g.root}' must not have a parent`);

  for (const a of byId.values()) {
    if (a.id === g.root) continue;
    if (!a.parent) { errors.push(`agent '${a.id}' has no parent (only the root may be parentless)`); continue; }
    if (!byId.has(a.parent)) { errors.push(`agent '${a.id}' parent '${a.parent}' does not exist`); continue; }
    // cycle check: walk up; if we never reach the root within n steps, it loops
    const seen = new Set<string>([a.id]);
    let cur: BOrgAgent | undefined = a;
    while (cur?.parent) {
      if (seen.has(cur.parent)) { errors.push(`cycle detected through agent '${a.id}'`); break; }
      seen.add(cur.parent);
      cur = byId.get(cur.parent);
    }
  }
  return { ok: errors.length === 0, errors, warnings };
}

export type BOrgBootSlice = {
  agent: BOrgAgent;
  chain: BOrgAgent[]; // root → … → agent (the authority path)
  rules: string[]; // inherited: every ancestor's rules first, own rules last
  buckets: string[]; // own + inherited (deduped)
  skills: string[];
  children: BOrgAgent[];
};

/** An agent's boot-time view of the organigram: who it is, what it inherits,
 *  who it commands. Pure — used by the MCP booboo_boot verb and the panel. */
export function orgBootSlice(org: BOrg, agentId: string): BOrgBootSlice | null {
  const byId = new Map(org.agents.map((a) => [a.id, a]));
  const agent = byId.get(agentId);
  if (!agent) return null;
  const chain: BOrgAgent[] = [];
  let cur: BOrgAgent | undefined = agent;
  const guard = new Set<string>();
  while (cur && !guard.has(cur.id)) {
    guard.add(cur.id);
    chain.unshift(cur);
    cur = cur.parent ? byId.get(cur.parent) : undefined;
  }
  const dedup = (xs: string[]) => [...new Set(xs)];
  return {
    agent,
    chain,
    rules: dedup(chain.flatMap((a) => a.rules ?? [])),
    buckets: dedup(chain.flatMap((a) => a.buckets ?? [])),
    skills: dedup(agent.skills ?? []),
    children: org.agents.filter((a) => a.parent === agentId),
  };
}

export const ORG_SPEC_VERSION = "1.0";

/** "3d ago" — how long since `iso`. Returns "" for anything undated or unparseable.
 *
 *  This lives here, in the package every surface already depends on, because it
 *  was implemented TWICE (panel and viewer) and the two copies drifted: the same
 *  report read "yesterday" on the staff board and "30h ago" in the 3D dossier,
 *  one click apart, and a three-year-old report read "1095d ago" on one surface
 *  and "3.0y ago" on the other. Two renderings of one fact is worse than the
 *  duplication that caused it. One age, everywhere. */
export function relTime(iso?: unknown): string {
  if (typeof iso !== "string" || !iso) return "";
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const s = (Date.now() - t) / 1000;
  if (s < 90) return "just now";
  if (s < 5400) return `${Math.round(s / 60)}m ago`;
  if (s < 172800) return `${Math.round(s / 3600)}h ago`;
  const days = Math.round(s / 86400);
  if (days < 60) return `${days}d ago`;
  const months = Math.round(days / 30.4);
  return months < 24 ? `${months}mo ago` : `${(months / 12).toFixed(1)}y ago`;
}
