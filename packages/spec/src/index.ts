// Booboo graph spec (v1) — the entire contract. Keep it small. See ../../../SPEC.md.

export type BLayer = { name: string; color?: string; label?: string };

export type BMeta = {
  root: string;
  title?: string;
  layers: BLayer[];
  generated?: string;
  counts?: { nodes: number; links: number };
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
    if (!n.id) { errors.push("a node is missing 'id'"); continue; }
    if (ids.has(n.id)) errors.push(`duplicate node id: ${n.id}`);
    ids.add(n.id);
    if (!n.layer || !layers.has(n.layer)) warnings.push(`node '${n.id}' layer '${n.layer}' is not in meta.layers`);
  }
  if (!ids.has(o.meta!.root)) errors.push(`meta.root '${o.meta!.root}' is not a node id`);

  let dangling = 0;
  for (const l of o.links!) if (!ids.has(l.source) || !ids.has(l.target)) dangling++;
  if (dangling) warnings.push(`${dangling} link(s) reference missing nodes (the builder drops these)`);

  return { ok: errors.length === 0, errors, warnings };
}

export const SPEC_VERSION = "1.0";
