import { createRoot } from "react-dom/client";
import { BoobooView, Booboo, defaultCfg } from "../src/index";
import { validate } from "@booboo-brain/spec";
import type { BoobooGraph, BNode, BLink } from "@booboo-brain/spec";

// The shipped, self-contained viewer app. `booboo view` serves this and loads
// the user's snapshot at runtime via ?file=/snapshot.json. ?n=<count> renders a
// synthetic brain (the scale showcase); no params → a friendly empty state.
// ?chrome=0 drops the HUD and renders the bare scene — for embedding the brain
// as a live background in an iframe.

// Deterministic 0..1 hash for coherent (non-random) synthetic structure.
function h(s: string): number {
  let x = 2166136261;
  for (let i = 0; i < s.length; i++) {
    x ^= s.charCodeAt(i);
    x = Math.imul(x, 16777619);
  }
  return ((x >>> 0) % 1000000) / 1000000;
}

// A COHERENT synthetic brain: root → agents → (memory | crons) + a power-law
// knowledge graph. Proves scale: ?n=1000000 builds a million-node brain.
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

// Minimal placeholder brain shown when the viewer opens with no data: the 3-tier spine.
function placeholder(): BoobooGraph {
  const layers = [
    { name: "orchestrator", color: "#e8e2d0", label: "ORCHESTRATOR" },
    { name: "project", color: "#4a90d9", label: "PROJECT" },
    { name: "agent", color: "#c9a04a", label: "AGENT" },
  ];
  return {
    booboo: "1.0",
    meta: { root: "orchestrator", title: "Booboo", layers },
    nodes: [
      { id: "orchestrator", type: "core", layer: "orchestrator", label: "Orchestrator", weight: 1, tier: 0, parent: null },
      { id: "project", type: "project", layer: "project", label: "Project", weight: 0.6, tier: 1, parent: "orchestrator" },
      { id: "agent", type: "agent", layer: "agent", label: "Agent", weight: 0.45, tier: 2, parent: "project" },
    ],
    links: [
      { source: "orchestrator", target: "project", type: "spine" },
      { source: "project", target: "agent", type: "spine" },
    ],
  };
}

// Thrown when a fetched snapshot fails spec validation; carries the error list to render.
class InvalidSnapshot extends Error {
  constructor(public errors: string[]) {
    super("snapshot failed validation");
  }
}

async function load(): Promise<BoobooGraph> {
  const file = q.get("file"); // ?file=<url> — what `booboo view --snapshot` points at
  const n = q.get("n");
  if (file) {
    const data = (await (await fetch(file)).json()) as unknown;
    const v = validate(data); // never throws — bad data gets a clean error state, not a white screen
    if (!v.ok) throw new InvalidSnapshot(v.errors);
    return data as BoobooGraph;
  }
  if (n) return synth(parseInt(n, 10));
  return placeholder();
}

const box: React.CSSProperties = {
  position: "fixed", inset: 0, display: "grid", placeItems: "center",
  color: "#9fb2c8", fontFamily: "ui-sans-serif, system-ui, sans-serif", textAlign: "center", padding: 24,
};

function Failed({ msg, errors }: { msg: string; errors?: string[] }) {
  return (
    <div style={box}>
      <div>
        <div style={{ fontSize: 18, color: "#e6a0a0" }}>{errors ? "Invalid snapshot" : "Couldn't load the snapshot"}</div>
        <div style={{ marginTop: 8, fontSize: 13, opacity: 0.8, maxWidth: 520, wordBreak: "break-word" }}>{msg}</div>
        {errors && errors.length > 0 && (
          <ul style={{ marginTop: 12, textAlign: "left", fontSize: 12.5, color: "#e6a0a0", opacity: 0.9, maxWidth: 520, lineHeight: 1.6, paddingLeft: 18 }}>
            {errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

const sel = q.get("node"); // ?node=<id> pre-opens a node's dossier (demos/screenshots)
const bare = q.get("chrome") === "0"; // background embed: scene only, labels off
const root = createRoot(document.getElementById("root")!);

// R3F measures its container on mount. Inside an iframe that measurement can
// land before R3F is listening, leaving the canvas at its 300x150 intrinsic
// default while the wrappers are correctly sized — a tiny scene in a corner.
// Verified: a resize event dispatched later always corrects it, so this is a
// pure startup race. Rather than guess a frame count, poll until the canvas
// has actually taken the container's size, then stop. Bounded at ~3s.
// The ResizeObserver then keeps an embed responsive to real size changes.
const nudge = () => {
  const el = document.getElementById("root")!;
  const settled = () => {
    const c = document.querySelector("canvas");
    if (!c) return false;
    const r = el.getBoundingClientRect();
    return Math.abs(c.clientWidth - r.width) < 2 && Math.abs(c.clientHeight - r.height) < 2;
  };

  let tries = 0;
  const tick = () => {
    if (settled() || tries++ > 30) return;
    window.dispatchEvent(new Event("resize"));
    setTimeout(tick, 100);
  };
  setTimeout(tick, 0);

  let w = 0, h = 0;
  new ResizeObserver(() => {
    const r = el.getBoundingClientRect();
    if (Math.round(r.width) === w && Math.round(r.height) === h) return;
    w = Math.round(r.width);
    h = Math.round(r.height);
    window.dispatchEvent(new Event("resize"));
  }).observe(el);
};

load()
  .then((data) => {
    root.render(
      bare
        // orbit turns the disc away from the camera on a wandering sine, so an
        // embedded background swings between spectacular and near-empty
        // depending when you land on it. drift (a slow in-plane roll) keeps it
        // alive while staying face-on, which is what a hero actually wants.
        ? <Booboo data={data} cfg={{ ...defaultCfg(data), labels: false, orbit: 0 }} />
        : <BoobooView data={data} initialSel={sel} controls={q.get("chrome") !== "lite"} />,
    );
    nudge();
  })
  .catch((e) =>
    root.render(
      e instanceof InvalidSnapshot
        ? <Failed msg="This snapshot doesn't match the Booboo spec:" errors={e.errors} />
        : <Failed msg={String(e?.message ?? e)} />,
    ),
  );
