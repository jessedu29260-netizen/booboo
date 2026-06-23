import { createRoot } from "react-dom/client";
import { BoobooView } from "../src/index";
import type { BoobooGraph, BNode, BLink } from "@booboo/spec";
import demo from "../../../examples/demo.booboo.json";

// Deterministic 0..1 hash for coherent (non-random) synthetic structure.
function h(s: string): number {
  let x = 2166136261;
  for (let i = 0; i < s.length; i++) {
    x ^= s.charCodeAt(i);
    x = Math.imul(x, 16777619);
  }
  return ((x >>> 0) % 1000000) / 1000000;
}

// A COHERENT fake industrial brain: root → agents → (memories | crons), plus a power-law
// knowledge graph. Used to prove scale: ?n=1000000 builds a million-node brain.
function synth(n: number): BoobooGraph {
  const layers = [
    { name: "agents", color: "#c9a04a", label: "AGENTS" },
    { name: "knowledge", color: "#4ECDC4", label: "KNOWLEDGE" },
    { name: "crons", color: "#5d8a6e", label: "CRONS" },
    { name: "memory", color: "#a78bd0", label: "MEMORY" },
  ];
  const nodes: BNode[] = [{ id: "core", type: "root", layer: "agents", label: "MEGA SYSTEM", weight: 1, tier: 0, parent: null, icon: "◈" }];
  const links: BLink[] = [];

  const agents = Math.max(8, Math.round(n * 0.004));
  for (let a = 0; a < agents; a++) {
    const id = `agent:${a}`;
    nodes.push({ id, type: "agent", layer: "agents", label: `Agent ${a}`, weight: 0.5 + h(id) * 0.2, tier: 1, parent: "core", cluster: `c${a}` });
    links.push({ source: "core", target: id, type: "spine" });
  }

  const kb = Math.max(20, Math.round(n * 0.18));
  for (let i = 0; i < kb; i++) {
    const id = `kb:${i}`;
    const parent = i < 12 ? "core" : `kb:${Math.floor(h(id) * Math.min(i, 240))}`;
    const tier = i < 60 ? 1 : i < 600 ? 2 : 3;
    nodes.push({ id, type: "entity", layer: "knowledge", label: `Entity ${i}`, weight: 0.18 + h(id) * 0.5, tier, parent, cluster: `k${i % 24}` });
    if (i % 11 === 0) links.push({ source: "core", target: id, type: "knows" });
  }

  const crons = Math.max(4, Math.round(n * 0.008));
  for (let i = 0; i < crons; i++) {
    const a = i % agents;
    nodes.push({ id: `cron:${i}`, type: "cron", layer: "crons", label: `job ${i}`, weight: 0.18, tier: 3, parent: `agent:${a}`, cluster: `c${a}` });
  }

  // memory = the bulk; clustered under each agent, Zipf-ish weights, sparse recall edges.
  const mem = Math.max(0, n - nodes.length);
  for (let i = 0; i < mem; i++) {
    const a = i % agents;
    const id = `mem:${i}`;
    nodes.push({ id, type: "memory", layer: "memory", label: `obs ${i}`, weight: 0.06 + h(id) * 0.14, tier: 3, parent: `agent:${a}`, cluster: `c${a}` });
    if (i % 7 === 0) links.push({ source: `agent:${a}`, target: id, type: "recalls" });
  }

  return {
    booboo: "1.0",
    meta: { root: "core", title: `Synthetic Brain · ${nodes.length.toLocaleString()} nodes`, layers, counts: { nodes: nodes.length, links: links.length } },
    nodes,
    links,
  };
}

const q = new URLSearchParams(location.search);
const nParam = q.get("n");
const fileParam = q.get("file"); // ?file=<url> loads any Booboo snapshot at runtime

async function load(): Promise<BoobooGraph> {
  if (fileParam) return (await (await fetch(fileParam)).json()) as BoobooGraph;
  if (nParam) return synth(parseInt(nParam, 10));
  return demo as unknown as BoobooGraph;
}

const selParam = q.get("node"); // ?node=<id> pre-opens that node's dossier (handy for demos/screenshots)
load().then((data) => createRoot(document.getElementById("root")!).render(<BoobooView data={data} initialSel={selParam} />));
