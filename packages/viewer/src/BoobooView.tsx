import { Component, useEffect, useMemo, useState, type ReactNode } from "react";
import type { BoobooGraph, BNode, BLink } from "@booboo-brain/spec";
import { Booboo, defaultCfg, type BoobooCfg } from "./Booboo";
import { usePersisted } from "./usePersisted";

/* ── design tokens ─────────────────────────────────────────────── */
const T = {
  bg: "#06080e",
  panel: "rgba(11,14,21,0.92)",
  panelSolid: "#0b0e15",
  card: "#0f131c",
  line: "#222734",
  text: "#E8DCC4",
  dim: "#8a8268",
  faint: "#585240",
  gold: "#c9a04a",
  goldHi: "#E8C877",
  green: "#5fae7e",
  amber: "#d6a23e",
  red: "#d05a5a",
  sans: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, system-ui, sans-serif",
  mono: "ui-monospace, SFMono-Regular, 'JetBrains Mono', monospace",
};
const PULSE_CSS =
  "@keyframes bbpulse{0%,100%{opacity:1}50%{opacity:.3}}.bb-pulse{animation:bbpulse 2.4s ease-in-out infinite}@media (prefers-reduced-motion:reduce){.bb-pulse{animation:none}}";

const copy = (text: string) => {
  try {
    void navigator.clipboard?.writeText(text);
  } catch {
    /* clipboard unavailable */
  }
};

type Rel = { dir: "out" | "in"; rel: string; other: string };

const mergeCfg = (initial: BoobooCfg, s: Partial<BoobooCfg>): BoobooCfg => ({
  ...initial,
  ...s,
  sizes: { ...initial.sizes, ...(s.sizes ?? {}) },
  layers: { ...initial.layers, ...(s.layers ?? {}) },
});
function urlCfg(): Partial<BoobooCfg> | null {
  if (typeof window === "undefined") return null;
  try {
    const u = new URLSearchParams(window.location.search).get("cfg");
    if (u) return JSON.parse(decodeURIComponent(u)) as Partial<BoobooCfg>;
  } catch {
    /* ignore malformed ?cfg= */
  }
  return null;
}

/* ── error boundary: a render throw shows a fallback, not a blank white canvas ── */
class RenderBoundary extends Component<{ children: ReactNode }, { msg: string | null }> {
  state = { msg: null as string | null };
  static getDerivedStateFromError(e: unknown) {
    return { msg: e instanceof Error ? e.message : String(e) };
  }
  render() {
    if (this.state.msg == null) return this.props.children;
    return (
      <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "#e6a0a0", fontFamily: T.sans, textAlign: "center", padding: 24 }}>
        <div>
          <div style={{ fontSize: 18 }}>Failed to render</div>
          <div style={{ marginTop: 8, fontSize: 13, opacity: 0.85, maxWidth: 520, wordBreak: "break-word", color: T.dim }}>{this.state.msg}</div>
        </div>
      </div>
    );
  }
}

/** Booboo + the full instrument: HUD · click→node menu · a collapsible control drawer.
 *  Controls live on the LEFT, the node menu on the RIGHT — they never overlap. */
export function BoobooView({
  data,
  persistKey = "booboo-cfg-v3",
  persist = true,
  initialSel = null,
  initialCfg,
}: {
  data: BoobooGraph;
  persistKey?: string;
  persist?: boolean;
  initialSel?: string | null;
  // Opening overrides merged over defaultCfg — lets a host set its own look
  // (e.g. a de-bloomed, peeled-wide layered view) without forking the viewer.
  initialCfg?: Partial<BoobooCfg>;
}) {
  const initial = useMemo(() => ({ ...defaultCfg(data), ...(initialCfg ?? {}) }), [data, initialCfg]);
  const [cfg, setCfg, resetCfg] = usePersisted<BoobooCfg>(persistKey, initial, persist, mergeCfg, urlCfg());
  const [sel, setSel] = useState<string | null>(initialSel);
  const [palette, setPalette] = useState(false);

  const byId = useMemo(() => new Map(data.nodes.map((n) => [n.id, n])), [data]);

  // semantic adjacency for the dossier — structural spines excluded so the verb
  // list reads as meaning, not plumbing (the Atlas dossier pattern)
  const adj = useMemo(() => {
    const m = new Map<string, Rel[]>();
    const push = (id: string, r: Rel) => {
      const a = m.get(id);
      if (a) a.push(r);
      else m.set(id, [r]);
    };
    for (const l of data.links) {
      if (l.type === "spine" || l.type === "tether") continue;
      push(l.source, { dir: "out", rel: l.type, other: l.target });
      push(l.target, { dir: "in", rel: l.type, other: l.source });
    }
    return m;
  }, [data]);

  // `/` opens the concierge palette (never while typing); Escape closes palette → dossier
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
      if (e.key === "/" && !typing) {
        e.preventDefault();
        setPalette(true);
      } else if (e.key === "Escape") {
        setPalette((p) => {
          if (p) return false;
          setSel(null);
          return p;
        });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const n of data.nodes) c[n.layer] = (c[n.layer] ?? 0) + 1;
    return c;
  }, [data]);
  const layerColor = useMemo(() => {
    const m: Record<string, string> = {};
    data.meta.layers.forEach((l) => (m[l.name] = l.color ?? "#9aa"));
    return m;
  }, [data]);
  const node = sel ? byId.get(sel) ?? null : null;

  return (
    <div style={{ position: "absolute", inset: 0, background: T.bg, fontFamily: T.sans }}>
      <style>{PULSE_CSS}</style>
      <RenderBoundary>
        <Booboo data={data} cfg={cfg} onSelect={setSel} sel={sel} />
      </RenderBoundary>

      {/* HUD — top-left */}
      <div style={{ position: "absolute", top: 18, left: 20, zIndex: 10, pointerEvents: "none" }}>
        <div style={{ color: T.gold, fontSize: 13, letterSpacing: 2.5, fontWeight: 700, fontFamily: T.mono }}>🐾 {data.meta.title ?? "BOOBOO"}</div>
        <div style={{ color: T.faint, fontSize: 10.5, letterSpacing: 0.6, marginTop: 3 }}>
          {data.nodes.length.toLocaleString()} nodes · {data.links.length.toLocaleString()} links · {data.meta.layers.length} layers
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "5px 12px", marginTop: 9, fontSize: 11 }}>
          {data.meta.layers.map((l) => (
            <span key={l.name} style={{ color: l.color ?? "#aaa", opacity: cfg.layers[l.name] !== false ? 1 : 0.32, display: "inline-flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 7, height: 7, borderRadius: 7, background: l.color ?? "#aaa", display: "inline-block" }} />
              {l.label ?? l.name} <b style={{ color: T.dim, fontWeight: 600 }}>{(counts[l.name] ?? 0).toLocaleString()}</b>
            </span>
          ))}
        </div>
      </div>

      <Controls data={data} cfg={cfg} setCfg={setCfg} resetCfg={resetCfg} />

      {node && <Dossier key={node.id} n={node} byId={byId} rels={adj.get(node.id) ?? []} accent={layerColor[node.layer] ?? T.gold} onClose={() => setSel(null)} onJump={setSel} />}

      {palette && <Palette data={data} layerColor={layerColor} onJump={(id) => { setSel(id); setPalette(false); }} onClose={() => setPalette(false)} />}

      <div style={{ position: "absolute", bottom: 12, left: "50%", transform: "translateX(-50%)", fontSize: 10, color: T.faint, pointerEvents: "none", letterSpacing: 0.4 }}>
        drag to rotate · scroll to zoom · click a node · <span style={{ color: T.dim }}>press / to find</span>
      </div>
    </div>
  );
}

/* ── the concierge palette: one input — find a node, jump to it ── */
function Palette({ data, layerColor, onJump, onClose }: { data: BoobooGraph; layerColor: Record<string, string>; onJump: (id: string) => void; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [hi, setHi] = useState(0);
  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (s.length < 2) return [];
    const hit = (n: BNode) => n.label.toLowerCase().includes(s) || n.id.toLowerCase().includes(s);
    const isObs = (n: BNode) => n.type === "obs" || n.type === "observation" || n.type === "memory";
    const prim = data.nodes.filter((n) => !isObs(n) && hit(n)).sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0));
    const sec = data.nodes.filter((n) => isObs(n) && hit(n));
    return [...prim, ...sec].slice(0, 14);
  }, [q, data]);
  useEffect(() => setHi(0), [q]);
  const pick = (i: number) => { const r = results[i]; if (r) onJump(r.id); };
  return (
    <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(4,6,10,0.55)", backdropFilter: "blur(3px)", zIndex: 30 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ position: "absolute", top: "16%", left: "50%", transform: "translateX(-50%)", width: 540, maxWidth: "92%", background: T.panelSolid, border: `1px solid ${T.line}`, borderRadius: 10, boxShadow: "0 24px 80px rgba(0,0,0,0.6)", overflow: "hidden" }}>
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setHi((h) => Math.min(h + 1, results.length - 1)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
            else if (e.key === "Enter") pick(hi);
          }}
          placeholder="Find anything in the house…"
          style={{ width: "100%", boxSizing: "border-box", background: "transparent", border: "none", outline: "none", color: T.text, fontFamily: T.mono, fontSize: 14, padding: "14px 16px", borderBottom: results.length ? `1px solid ${T.line}` : "none" }}
        />
        {results.length > 0 && (
          <div style={{ maxHeight: 380, overflowY: "auto", padding: 6 }}>
            {results.map((r, i) => (
              <div key={r.id} onClick={() => pick(i)} onMouseEnter={() => setHi(i)} style={{ display: "flex", alignItems: "center", gap: 9, padding: "7px 10px", borderRadius: 6, cursor: "pointer", background: i === hi ? "#141926" : "transparent" }}>
                <span style={{ width: 7, height: 7, borderRadius: 7, flex: "0 0 auto", background: layerColor[r.layer] ?? T.dim }} />
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: T.text, fontSize: 12.5 }}>{r.icon ? r.icon + " " : ""}{r.label}</span>
                <span style={{ marginLeft: "auto", flex: "0 0 auto", color: T.faint, fontSize: 9.5, border: `1px solid ${T.line}`, borderRadius: 4, padding: "1px 6px", letterSpacing: 0.4 }}>{r.type}</span>
              </div>
            ))}
          </div>
        )}
        {q.trim().length >= 2 && results.length === 0 && (
          <div style={{ padding: "12px 16px", color: T.dim, fontSize: 11.5, display: "flex", alignItems: "center", gap: 8 }}>
            No matches — the house also answers questions over MCP.
            <button onClick={() => copy(`${location.origin}/mcp`)} style={{ ...btn(), fontSize: 9.5, flex: "0 0 auto" }}>copy endpoint</button>
          </div>
        )}
        <div style={{ padding: "7px 16px", borderTop: `1px solid ${T.line}`, color: T.faint, fontSize: 9.5, letterSpacing: 0.5, display: "flex", gap: 14 }}>
          <span>↑↓ move</span><span>↵ open</span><span>esc close</span>
        </div>
      </div>
    </div>
  );
}

/* ── Controls: collapsible left drawer (never collides with the right menu) ── */
function Controls({
  data,
  cfg,
  setCfg,
  resetCfg,
}: {
  data: BoobooGraph;
  cfg: BoobooCfg;
  setCfg: (patch: Partial<BoobooCfg> | ((p: BoobooCfg) => BoobooCfg)) => void;
  resetCfg: () => void;
}) {
  const [open, setOpen] = useState(true);
  const layerVisible = (name: string) => cfg.layers[name] !== false;
  const toggleLayer = (name: string) => setCfg((p) => ({ ...p, layers: { ...p.layers, [name]: !layerVisible(name) } }));
  const setSize = (name: string, v: number) => setCfg((p) => ({ ...p, sizes: { ...p.sizes, [name]: v } }));
  const copyWallpaper = () => copy(`${location.origin}${location.pathname}?cfg=${encodeURIComponent(JSON.stringify(cfg))}`);

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} title="display controls" style={{ position: "absolute", bottom: 22, left: 20, background: T.panel, border: `1px solid ${T.line}`, color: T.dim, borderRadius: 8, padding: "8px 12px", cursor: "pointer", fontFamily: T.sans, fontSize: 11, letterSpacing: 0.5, backdropFilter: "blur(8px)", display: "flex", alignItems: "center", gap: 7 }}>
        <span style={{ fontSize: 13 }}>⚙</span> Controls
      </button>
    );
  }
  return (
    <div style={{ position: "absolute", bottom: 22, left: 20, width: 236, maxHeight: "calc(100vh - 44px)", overflowY: "auto", zIndex: 10, background: T.panel, border: `1px solid ${T.line}`, borderRadius: 10, padding: 14, display: "flex", flexDirection: "column", gap: 10, fontSize: 11, color: T.dim, backdropFilter: "blur(10px)", boxShadow: "0 12px 40px rgba(0,0,0,0.45)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ color: T.text, letterSpacing: 1, fontSize: 11, fontWeight: 600 }}>Controls</span>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={() => setCfg({ orbit: 0, drift: 0 })} title="pause spin + drift" style={btn()}>❄ still</button>
          <button onClick={resetCfg} style={btn()}>reset</button>
          <button onClick={() => setOpen(false)} title="hide" style={{ ...btn(), padding: "3px 8px" }}>✕</button>
        </div>
      </div>
      <Section label="scene">
        <Slider label="⟳ drift" v={cfg.drift} min={0} max={2.5} step={0.05} on={(v) => setCfg({ drift: v })} />
        <Toggle on={cfg.orbit > 0} onClick={() => setCfg({ orbit: cfg.orbit > 0 ? 0 : 1 })} label="✦ spin" tone="green" />
        <Slider label="spin" v={cfg.orbit} min={0} max={2.5} step={0.05} on={(v) => setCfg({ orbit: v })} />
        <Slider label="≋ fog" v={cfg.fog} min={0} max={2} step={0.05} on={(v) => setCfg({ fog: v })} />
        <Slider label="◐ film" v={cfg.cinematic} min={-0.8} max={1.6} step={0.05} on={(v) => setCfg({ cinematic: v })} />
        <Slider label="peel" v={cfg.peel} min={0.2} max={2.5} step={0.05} on={(v) => setCfg({ peel: v })} />
      </Section>
      <Section label="display">
        <div style={{ display: "flex", gap: 6 }}>
          <Toggle on={cfg.labels} onClick={() => setCfg({ labels: !cfg.labels })} label="labels" tone="green" />
          <Toggle on={cfg.platforms} onClick={() => setCfg({ platforms: !cfg.platforms })} label="planes" tone="green" />
          <Toggle on={cfg.rings} onClick={() => setCfg({ rings: !cfg.rings })} label="rings" tone="green" />
        </div>
        <Slider label="glow" v={cfg.bloom} min={0} max={3} step={0.05} on={(v) => setCfg({ bloom: v })} />
        <Slider label="lines" v={cfg.lines} min={0} max={2} step={0.02} on={(v) => setCfg({ lines: v })} />
        <Slider label="≈ pulse" v={cfg.flow} min={0} max={3} step={0.1} on={(v) => setCfg({ flow: v })} />
        <Slider label="size" v={cfg.nodeScale} min={0.3} max={2.5} step={0.05} on={(v) => setCfg({ nodeScale: v })} />
      </Section>
      <Section label="isolate layers">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
          {data.meta.layers.map((l) => {
            const on = layerVisible(l.name);
            return (
              <button key={l.name} onClick={() => toggleLayer(l.name)} style={{ flex: "1 0 44%", background: on ? "#161a24" : "transparent", border: `1px solid ${on ? l.color ?? "#888" : T.line}`, color: on ? l.color ?? "#ccc" : T.faint, borderRadius: 5, padding: "4px 5px", cursor: "pointer", fontFamily: T.sans, fontSize: 10, letterSpacing: 0.3, display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                <span style={{ width: 6, height: 6, borderRadius: 6, background: on ? l.color ?? "#888" : T.faint }} />
                {l.label ?? l.name}
              </button>
            );
          })}
        </div>
      </Section>
      <Section label="node sizes">
        {data.meta.layers.map((l) => (
          <Slider key={l.name} label={l.label ?? l.name} v={cfg.sizes[l.name] ?? 1} min={0} max={8} step={0.1} on={(v) => setSize(l.name, v)} />
        ))}
      </Section>
      <button onClick={copyWallpaper} title="copy a link that reopens this exact view" style={{ ...btn(), padding: "7px", marginTop: 2 }}>⊕ copy wallpaper link</button>
    </div>
  );
}

/* ── health blend (status_pill + p0) ── */
function healthOf(status: string | null, p0: number | null): { score: number; color: string; label: string } {
  let score = status === "green" ? 1 : status === "amber" ? 0.6 : status === "red" ? 0.25 : 0.5;
  if (p0 != null && p0 > 0) score = Math.min(score, 0.28);
  const color = score > 0.72 ? T.green : score > 0.42 ? T.amber : T.red;
  const base = status === "green" ? "healthy" : status === "amber" ? "watch" : status === "red" ? "critical" : "—";
  const label = p0 != null && p0 > 0 ? `${p0} P0 · ${score <= 0.42 ? "critical" : base}` : base;
  return { score, color, label };
}

/* ── Dossier: the node menu — health-first, tabbed ── */
function Dossier({
  n,
  byId,
  rels,
  accent,
  onClose,
  onJump,
}: {
  n: BNode;
  byId: Map<string, BNode>;
  rels: Rel[];
  accent: string;
  onClose: () => void;
  onJump: (id: string) => void;
}) {
  // relations grouped BY VERB, count-sorted — "owns 12 · reads 3 · escalates_to 1"
  const groups = useMemo(() => {
    const g = new Map<string, Rel[]>();
    for (const r of rels) {
      const a = g.get(r.rel);
      if (a) a.push(r);
      else g.set(r.rel, [r]);
    }
    return [...g.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [rels]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const d = (n.data ?? {}) as Record<string, unknown>;
  const status = typeof d.status_pill === "string" ? d.status_pill : null;
  const p0raw = d.p0_count;
  const p0 = p0raw == null || p0raw === "" ? null : Number(p0raw);
  const phase = d.phase != null ? String(d.phase) : null;
  const lastMove = d.last_move != null && String(d.last_move).trim() ? String(d.last_move) : null;
  const nextPlan = d.next_plan != null && String(d.next_plan).trim() ? String(d.next_plan) : null;
  const hasHealth = status != null || (p0 != null && !Number.isNaN(p0));

  const RESERVED = new Set(["status_pill", "p0_count", "phase", "last_move", "next_plan"]);
  const promptEntries = Object.entries(d).filter(
    ([k, v]) => !RESERVED.has(k) && typeof v === "string" && (k.toLowerCase().includes("prompt") || ["system", "instructions"].includes(k.toLowerCase()) || (v as string).length > 120),
  ) as [string, string][];
  const dataEntries = Object.entries(d).map(([k, v]) => [k, typeof v === "string" ? v : JSON.stringify(v, null, 2)] as [string, string]);

  const tabs = ["overview", promptEntries.length ? "prompt" : null, rels.length ? "relations" : null, dataEntries.length ? "data" : null].filter(Boolean) as string[];
  const [tab, setTab] = useState("overview");

  return (
    // z 20 (tokens z-map): the 3D label portals render inside the canvas
    // container and would otherwise bleed through the panel.
    <div style={{ position: "absolute", top: 0, right: 0, width: 420, maxWidth: "94%", height: "100%", zIndex: 20, background: T.panelSolid, borderLeft: `1px solid ${T.line}`, color: T.text, display: "flex", flexDirection: "column", boxShadow: "-18px 0 50px rgba(0,0,0,0.45)" }}>
      {/* fixed header + tabs */}
      <div style={{ flex: "0 0 auto", background: T.panelSolid, borderBottom: `1px solid ${T.line}`, borderLeft: `3px solid ${accent}` }}>
        <div style={{ padding: "16px 18px 12px", position: "relative" }}>
          <button onClick={onClose} title="close" style={{ position: "absolute", top: 12, right: 14, background: "none", border: "none", color: T.dim, cursor: "pointer", fontSize: 18, lineHeight: 1 }}>×</button>
          <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: T.dim }}>
            <span style={{ width: 8, height: 8, borderRadius: 8, background: accent }} />
            {n.type} · {n.layer}
          </div>
          <div style={{ fontSize: 19, marginTop: 8, color: "#f5ebd4", wordBreak: "break-word", fontWeight: 600, lineHeight: 1.25 }}>
            {n.icon ? n.icon + " " : ""}
            {n.label}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
            <code style={{ fontFamily: T.mono, fontSize: 11, color: T.dim, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.id}</code>
            <button onClick={() => copy(n.id)} title="copy id" style={{ ...btn(), padding: "2px 7px", fontSize: 9, flex: "0 0 auto" }}>copy</button>
          </div>
        </div>
        <div style={{ display: "flex", gap: 2, padding: "0 14px" }}>
          {tabs.map((t) => (
            <button key={t} onClick={() => setTab(t)} style={{ background: "none", border: "none", borderBottom: `2px solid ${tab === t ? accent : "transparent"}`, color: tab === t ? T.text : T.dim, padding: "8px 9px", cursor: "pointer", fontFamily: T.sans, fontSize: 11, letterSpacing: 0.4, textTransform: "capitalize" }}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* scrollable content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "14px 18px 28px", fontSize: 12 }}>
        {tab === "overview" && (
          <>
            {hasHealth && <HealthBar status={status} p0={p0} />}
            {phase && <Card label="current phase" value={phase} accent={accent} mono />}
            {lastMove && <Card label="last move" value={lastMove} accent={accent} scroll />}
            {nextPlan && <Card label="next plan" value={nextPlan} accent={accent} scroll />}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}>
              {([["weight", n.weight != null ? n.weight.toFixed(2) : "—"], ["tier", n.tier != null ? String(n.tier) : "—"], ["cluster", n.cluster ?? "—"], ["parent", n.parent ?? "—"]] as [string, string][]).map(([k, v]) => (
                <div key={k} style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 7, padding: "8px 10px" }}>
                  <div style={{ color: T.faint, fontSize: 9.5, letterSpacing: 1, textTransform: "uppercase" }}>{k}</div>
                  <div style={{ color: T.text, fontSize: 13, marginTop: 3, fontFamily: T.mono, wordBreak: "break-word" }}>{v}</div>
                </div>
              ))}
            </div>
          </>
        )}

        {tab === "prompt" && promptEntries.map(([k, v]) => <EditableBlock key={k} label={k} value={v} accent={accent} />)}

        {tab === "relations" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {groups.map(([verb, list]) => {
              const cap = expanded[verb] ? list.length : 10;
              return (
                <div key={verb}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
                    <span style={{ color: accent, fontSize: 11, fontWeight: 600, letterSpacing: 0.6, fontFamily: T.mono }}>{verb}</span>
                    <span style={{ color: T.faint, fontSize: 10.5, fontFamily: T.mono }}>{list.length}</span>
                    <span style={{ flex: 1, height: 1, background: T.line }} />
                  </div>
                  {list.slice(0, cap).map((r, i) => {
                    const o = byId.get(r.other);
                    return (
                      <div key={i} onClick={() => onJump(r.other)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 8px", cursor: "pointer", borderRadius: 6 }} onMouseEnter={(e) => (e.currentTarget.style.background = "#12161f")} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                        <span title={r.dir === "out" ? "outgoing" : "incoming"} style={{ color: T.faint, flex: "0 0 auto", fontFamily: T.mono, fontSize: 12 }}>{r.dir === "out" ? "→" : "←"}</span>
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: T.text }}>{o?.icon ? o.icon + " " : ""}{o?.label ?? r.other}</span>
                      </div>
                    );
                  })}
                  {list.length > 10 && (
                    <button onClick={() => setExpanded((x) => ({ ...x, [verb]: !x[verb] }))} style={{ ...btn(), marginTop: 3, fontSize: 9.5 }}>
                      {expanded[verb] ? "show fewer" : `+${list.length - 10} more`}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {tab === "data" &&
          dataEntries.map(([k, v]) => (v.includes("\n") || v.length > 70 ? <EditableBlock key={k} label={k} value={v} accent={accent} /> : <Row key={k} k={k} v={v} />))}
      </div>
    </div>
  );
}

function HealthBar({ status, p0 }: { status: string | null; p0: number | null }) {
  const h = healthOf(status, p0);
  return (
    <div style={{ marginBottom: 2 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 7, color: T.dim, fontSize: 10, letterSpacing: 1.2, textTransform: "uppercase" }}>
          <span className="bb-pulse" style={{ width: 8, height: 8, borderRadius: 8, background: h.color }} /> health
        </span>
        <span style={{ color: h.color, fontSize: 11, fontWeight: 600, textTransform: "capitalize" }}>{h.label}</span>
      </div>
      <div style={{ height: 6, borderRadius: 6, background: "#171b24", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${Math.round(h.score * 100)}%`, background: h.color, borderRadius: 6, transition: "width .3s ease" }} />
      </div>
    </div>
  );
}

function Card({ label, value, accent, scroll, mono }: { label: string; value: string; accent: string; scroll?: boolean; mono?: boolean }) {
  return (
    <div style={{ marginTop: 12, background: T.card, border: `1px solid ${T.line}`, borderRadius: 8, padding: "10px 12px" }}>
      <div style={{ color: accent, fontSize: 10, letterSpacing: 1, textTransform: "uppercase", fontWeight: 600, marginBottom: 5 }}>{label}</div>
      <div style={{ color: T.text, fontSize: 12.5, lineHeight: 1.5, fontFamily: mono ? T.mono : T.sans, whiteSpace: "pre-wrap", wordBreak: "break-word", maxHeight: scroll ? 96 : undefined, overflowY: scroll ? "auto" : undefined }}>{value}</div>
    </div>
  );
}

function EditableBlock({ label, value, accent }: { label: string; value: string; accent: string }) {
  const [text, setText] = useState(value);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    setText(value);
    setCopied(false);
  }, [value]);
  const edited = text !== value;
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
        <span style={{ color: accent, fontSize: 10, letterSpacing: 1, textTransform: "uppercase", fontWeight: 600 }}>{label}</span>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {edited && <button onClick={() => setText(value)} title="revert edits" style={{ ...btn(), padding: "2px 7px", fontSize: 9 }}>revert</button>}
          <button onClick={() => { copy(text); setCopied(true); }} style={{ ...btn(), padding: "2px 9px", fontSize: 9, color: copied ? T.green : T.dim, borderColor: copied ? "#3a5a44" : T.line }}>{copied ? "✓ copied" : "copy"}</button>
        </div>
      </div>
      <textarea value={text} onChange={(e) => { setText(e.target.value); setCopied(false); }} spellCheck={false} rows={Math.min(18, Math.max(4, text.split("\n").length + 1))} style={{ width: "100%", boxSizing: "border-box", background: "#0d111a", border: `1px solid ${edited ? accent : T.line}`, borderRadius: 7, color: T.text, fontFamily: T.mono, fontSize: 11.5, lineHeight: 1.5, padding: "9px 11px", resize: "vertical", outline: "none" }} />
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 14, padding: "6px 0", borderBottom: `1px solid ${T.line}` }}>
      <span style={{ color: T.dim, flex: "0 0 auto" }}>{k}</span>
      <span style={{ textAlign: "right", wordBreak: "break-word", color: T.text, fontFamily: T.mono, fontSize: 11.5 }}>{v}</span>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
      <div style={{ color: T.faint, fontSize: 9.5, letterSpacing: 1, textTransform: "uppercase" }}>{label}</div>
      {children}
    </div>
  );
}

function btn(): React.CSSProperties {
  return { background: "transparent", border: `1px solid ${T.line}`, color: T.dim, borderRadius: 5, padding: "3px 9px", cursor: "pointer", fontFamily: T.sans, fontSize: 10, letterSpacing: 0.3 };
}

function Toggle({ on, onClick, label, tone }: { on: boolean; onClick: () => void; label: string; tone: "gold" | "green" }) {
  const c = tone === "green" ? { bg: "#16241a", bd: "#3a5a44", fg: "#9ed3b0" } : { bg: "#221c10", bd: "#5a4a28", fg: T.goldHi };
  return (
    <button onClick={onClick} style={{ flex: 1, background: on ? c.bg : "transparent", border: `1px solid ${on ? c.bd : T.line}`, color: on ? c.fg : T.faint, borderRadius: 6, padding: "5px 6px", cursor: "pointer", fontFamily: T.sans, fontSize: 10.5, letterSpacing: 0.4 }}>
      {label}
    </button>
  );
}

function Slider({ label, v, min, max, step, on }: { label: string; v: number; min: number; max: number; step: number; on: (v: number) => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
      <span style={{ width: 48, color: T.dim, fontSize: 10, flex: "0 0 auto" }}>{label}</span>
      <input type="range" min={min} max={max} step={step} value={v} onChange={(e) => on(parseFloat(e.target.value))} style={{ flex: 1, accentColor: T.gold, minWidth: 0 }} />
      <span style={{ color: T.text, width: 30, textAlign: "right", fontFamily: T.mono, fontSize: 10.5, flex: "0 0 auto" }}>{v.toFixed(2)}</span>
    </div>
  );
}
