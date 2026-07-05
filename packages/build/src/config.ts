import { readFileSync } from "node:fs";
import { parse as parseYaml } from "yaml";

export type NodeSpec = {
  table: string;
  layer: string;
  id: string; // column → node id
  label: string; // column → label
  type?: string; // node type (default = layer)
  prefix?: string; // prepended to id (e.g. "agent:")
  weight?: number; // constant weight
  weight_from?: string; // OR a numeric column, normalised 0..1
  tier?: number;
  cluster?: string; // column → grouping key (also the default wall field)
  wall_field?: string; // column whose value is matched against config.walls; defaults to cluster
  icon?: string; // column → emoji/asset
  color?: string; // column → hex
  parent?: string; // literal node id (e.g. "core")
  where?: string; // raw SQL WHERE (trusted config)
  data?: string[]; // extra columns to pull verbatim into node.data (e.g. prompt, phase, last_move)
};
export type LinkSpec = { table: string; source: string; target: string; type?: string; where?: string };

export type Source =
  | { adapter: "postgres"; url: string; nodes?: NodeSpec[]; links?: LinkSpec[] }
  | { adapter: "json"; path: string };

export type BoobooConfig = {
  title?: string;
  root: { id: string; type?: string; label?: string; layer?: string };
  layers: { name: string; color?: string; label?: string }[];
  walls?: string[];
  sources: Source[];
  output?: { snapshot?: string };
  /** parse [[wikilinks]] out of node labels/data strings into `authored` edges —
   *  deliberate links a writer chose, ranked above harvested relations. */
  wikilinks?: boolean;
};

const envSub = (s: string): string => s.replace(/\$\{([^}]+)\}/g, (_, k) => process.env[k] ?? "");
function deepEnv<T>(o: T): T {
  if (typeof o === "string") return envSub(o) as unknown as T;
  if (Array.isArray(o)) return o.map(deepEnv) as unknown as T;
  if (o && typeof o === "object") {
    const r: Record<string, unknown> = {};
    for (const k in o as Record<string, unknown>) r[k] = deepEnv((o as Record<string, unknown>)[k]);
    return r as unknown as T;
  }
  return o;
}

/** Load + parse an booboo.config.yaml, substituting ${ENV_VAR} from process.env. */
export function loadConfig(path: string): BoobooConfig {
  const raw = parseYaml(readFileSync(path, "utf8"));
  return deepEnv(raw) as BoobooConfig;
}
