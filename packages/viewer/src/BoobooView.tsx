import { useEffect, useMemo, useState } from "react";
import type { BoobooGraph, BNode, BLink } from "@booboo/spec";
import { Booboo, defaultCfg, type BoobooCfg } from "./Booboo";
import { usePersisted } from "./usePersisted";

/* ── design tokens ─────────────────────────────────────────────── */
const T = {
  bg: "#06080e",
  panel: "rgba(11,14,21,0.92)",
  panelSolid: "#0b0e15",
  line: "#222734",
  lineStrong: "#323a4a",
  text: "#E8DCC4", // parchment
  dim: "#8a8268",
  faint: "#585240",
  gold: "#c9a04a",
  goldHi: "#E8C877",
  sans: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, system-ui, sans-serif",
  mono: "ui-monospace, SFMono-Regular, 'JetBrains Mono', monospace",
};
const copy = (text: string) => {
  try {
    void navigator.clipboard?.writeText(text);
  } catch {
    /* clipboard unavailable */
  }
};

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

/** Booboo + the full instrument: HUD · click→dossier · a collapsible control drawer.
 *  Controls live on the LEFT, the dossier on the RIGHT — they never overlap.
 *  Toggle changes persist to localStorage (per `persistKey`). persist={false} = kiosk/wallpaper. */
export function BoobooView({
  data,
  persistKey = "booboo-cfg-v2",
  persist = true,
  initialSel = null,
}: {
  data: BoobooGraph;
  persistKey?: string;
  persist?: boolean;
  initialSel?: string | null;
}) {
  const initial = useMemo(() => defaultCfg(data), [data]);
  const [cfg, setCfg, resetCfg] = usePersisted<BoobooCfg>(persistKey, initial, persist, mergeCfg, urlCfg());
  const [sel, setSel] = useState<string | null>(initialSel);

  const byId = useMemo(() => new Map(data.nodes.map((n) => [n.id, n])), [data]);
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
      <Booboo data={data} cfg={cfg} onSelect={setSel} />

      {/* HUD — top-left */}
      <div style={{ position: "absolute", top: 18, left: 20, pointerEvents: "none" }}>
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

      <Controls data={data} cfg={cfg} setCfg={setCfg} resetCfg={resetCfg} dossierOpen={!!node} />

      {node && <Dossier n={node} byId={byId} links={data.links} accent={layerColor[node.layer] ?? T.gold} onClose={() => setSel(null)} onJump={setSel} />}

      <div style={{ position: "absolute", bottom: 12, left: "50%", transform: "translateX(-50%)", fontSize: 10, color: T.faint, pointerEvents: "none", letterSpacing: 0.4 }}>
        drag to rotate · scroll to zoom · click a node
      </div>
    </div>
  );
}

/* ── Controls: collapsible left drawer (never collides with the right dossier) ── */
function Controls({
  data,
  cfg,
  setCfg,
  resetCfg,
  dossierOpen,
}: {
  data: BoobooGraph;
  cfg: BoobooCfg;
  setCfg: (patch: Partial<BoobooCfg> | ((p: BoobooCfg) => BoobooCfg)) => void;
  resetCfg: () => void;
  dossierOpen: boolean;
}) {
  const [open, setOpen] = useState(false);
  const layerVisible = (name: string) => cfg.layers[name] !== false;
  const toggleLayer = (name: string) => setCfg((p) => ({ ...p, layers: { ...p.layers, [name]: !layerVisible(name) } }));
  const setSize = (name: string, v: number) => setCfg((p) => ({ ...p, sizes: { ...p.sizes, [name]: v } }));
  const copyWallpaper = () => copy(`${location.origin}${location.pathname}?cfg=${encodeURIComponent(JSON.stringify(cfg))}`);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        title="display controls"
        style={{
          position: "absolute",
          bottom: 22,
          left: 20,
          background: T.panel,
          border: `1px solid ${T.line}`,
          color: T.dim,
          borderRadius: 8,
          padding: "8px 12px",
          cursor: "pointer",
          fontFamily: T.sans,
          fontSize: 11,
          letterSpacing: 0.5,
          backdropFilter: "blur(8px)",
          display: "flex",
          alignItems: "center",
          gap: 7,
        }}
      >
        <span style={{ fontSize: 13 }}>⚙</span> Controls
      </button>
    );
  }

  return (
    <div
      style={{
        position: "absolute",
        bottom: 22,
        left: 20,
        width: 236,
        maxHeight: "calc(100vh - 44px)",
        overflowY: "auto",
        background: T.panel,
        border: `1px solid ${T.line}`,
        borderRadius: 10,
        padding: 14,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        fontSize: 11,
        color: T.dim,
        backdropFilter: "blur(10px)",
        boxShadow: "0 12px 40px rgba(0,0,0,0.45)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ color: T.text, letterSpacing: 1, fontSize: 11, fontWeight: 600 }}>Controls</span>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={resetCfg} style={btn(T)}>
            reset
          </button>
          <button onClick={() => setOpen(false)} title="hide" style={{ ...btn(T), padding: "3px 8px" }}>
            ✕
          </button>
        </div>
      </div>

      <Section T={T} label="scene">
        <div style={{ display: "flex", gap: 7 }}>
          <Toggle on={cfg.lines} onClick={() => setCfg({ lines: !cfg.lines })} label="links" tone="gold" />
          <Toggle on={cfg.orbit > 0} onClick={() => setCfg({ orbit: cfg.orbit > 0 ? 0 : 1 })} label="✦ spin" tone="green" />
        </div>
        <Slider label="spin" v={cfg.orbit} min={0} max={2.5} step={0.05} on={(v) => setCfg({ orbit: v })} />
        <Slider label="link" v={cfg.lineOpacity} min={0} max={0.4} step={0.01} on={(v) => setCfg({ lineOpacity: v })} />
        <Slider label="size" v={cfg.nodeScale} min={0.3} max={2.5} step={0.05} on={(v) => setCfg({ nodeScale: v })} />
      </Section>

      <Section T={T} label="isolate layers">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
          {data.meta.layers.map((l) => {
            const on = layerVisible(l.name);
            return (
              <button
                key={l.name}
                onClick={() => toggleLayer(l.name)}
                style={{
                  flex: "1 0 44%",
                  background: on ? "#161a24" : "transparent",
                  border: `1px solid ${on ? l.color ?? "#888" : T.line}`,
                  color: on ? l.color ?? "#ccc" : T.faint,
                  borderRadius: 5,
                  padding: "4px 5px",
                  cursor: "pointer",
                  fontFamily: T.sans,
                  fontSize: 10,
                  letterSpacing: 0.3,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 5,
                }}
              >
                <span style={{ width: 6, height: 6, borderRadius: 6, background: on ? l.color ?? "#888" : T.faint }} />
                {l.label ?? l.name}
              </button>
            );
          })}
        </div>
      </Section>

      <Section T={T} label="node sizes">
        {data.meta.layers.map((l) => (
          <Slider key={l.name} label={l.label ?? l.name} v={cfg.sizes[l.name] ?? 1} min={0.2} max={3} step={0.05} on={(v) => setSize(l.name, v)} />
        ))}
      </Section>

      <button onClick={copyWallpaper} title="copy a link that reopens this exact view" style={{ ...btn(T), padding: "7px", marginTop: 2, color: T.dim }}>
        ⊕ copy wallpaper link
      </button>
    </div>
  );
}

/* ── Dossier: the redesigned report / node panel ── */
function Dossier({
  n,
  byId,
  links,
  accent,
  onClose,
  onJump,
}: {
  n: BNode;
  byId: Map<string, BNode>;
  links: BLink[];
  accent: string;
  onClose: () => void;
  onJump: (id: string) => void;
}) {
  const rels = useMemo(() => links.filter((l) => l.source === n.id || l.target === n.id).slice(0, 60), [n.id, links]);
  const stats: [string, string][] = [
    ["weight", n.weight != null ? n.weight.toFixed(2) : "—"],
    ["tier", n.tier != null ? String(n.tier) : "—"],
    ["cluster", n.cluster ?? "—"],
    ["parent", n.parent ?? "—"],
  ];
  const dataEntries = n.data ? Object.entries(n.data) : [];

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        right: 0,
        width: 392,
        maxWidth: "92%",
        height: "100%",
        background: T.panel,
        borderLeft: `1px solid ${T.line}`,
        backdropFilter: "blur(12px)",
        color: T.text,
        overflowY: "auto",
        fontSize: 12,
        boxShadow: "-18px 0 50px rgba(0,0,0,0.4)",
      }}
    >
      {/* accent strip = layer colour */}
      <div style={{ position: "sticky", top: 0, zIndex: 2, background: T.panelSolid, borderBottom: `1px solid ${T.line}`, padding: "16px 18px 14px", borderLeft: `3px solid ${accent}` }}>
        <button onClick={onClose} title="close" style={{ position: "absolute", top: 12, right: 14, background: "none", border: "none", color: T.dim, cursor: "pointer", fontSize: 18, lineHeight: 1 }}>
          ×
        </button>
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
          <button onClick={() => copy(n.id)} title="copy id" style={{ ...btn(T), padding: "2px 7px", fontSize: 9, flex: "0 0 auto" }}>
            copy
          </button>
        </div>
      </div>

      <div style={{ padding: "14px 18px 28px" }}>
        {/* stats grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {stats.map(([k, v]) => (
            <div key={k} style={{ background: "#0f131c", border: `1px solid ${T.line}`, borderRadius: 7, padding: "8px 10px" }}>
              <div style={{ color: T.faint, fontSize: 9.5, letterSpacing: 1, textTransform: "uppercase" }}>{k}</div>
              <div style={{ color: T.text, fontSize: 13, marginTop: 3, fontFamily: T.mono, wordBreak: "break-word" }}>{v}</div>
            </div>
          ))}
        </div>

        {/* data */}
        {dataEntries.length > 0 && (
          <>
            <Head T={T}>data</Head>
            {dataEntries.map(([k, v]) => {
              const isString = typeof v === "string";
              const str = isString ? (v as string) : JSON.stringify(v, null, 2);
              const long = str.includes("\n") || str.length > 70;
              return long ? <EditableBlock key={k} label={k} value={str} accent={accent} /> : <Row key={k} k={k} v={str} />;
            })}
          </>
        )}

        {/* relations */}
        {rels.length > 0 && (
          <>
            <Head T={T}>
              relations <span style={{ color: T.faint }}>· {rels.length}</span>
            </Head>
            <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {rels.map((l, i) => {
                const other = l.source === n.id ? l.target : l.source;
                const o = byId.get(other);
                const out = l.source === n.id;
                return (
                  <div
                    key={i}
                    onClick={() => onJump(other)}
                    style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", cursor: "pointer", borderRadius: 6 }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#12161f")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <span title={out ? "outgoing" : "incoming"} style={{ color: T.faint, flex: "0 0 auto", fontFamily: T.mono, fontSize: 12 }}>
                      {out ? "→" : "←"}
                    </span>
                    <span style={{ color: T.faint, fontSize: 10, flex: "0 0 auto", padding: "1px 6px", border: `1px solid ${T.line}`, borderRadius: 4, letterSpacing: 0.3 }}>{l.type}</span>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: T.text }}>{o?.label ?? other}</span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ── small editable, copy-pasteable block for prompts / long text ── */
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
          {edited && (
            <button onClick={() => setText(value)} title="revert edits" style={{ ...btn(T), padding: "2px 7px", fontSize: 9 }}>
              revert
            </button>
          )}
          <button
            onClick={() => {
              copy(text);
              setCopied(true);
            }}
            style={{ ...btn(T), padding: "2px 9px", fontSize: 9, color: copied ? "#9ed3b0" : T.dim, borderColor: copied ? "#3a5a44" : T.line }}
          >
            {copied ? "✓ copied" : "copy"}
          </button>
        </div>
      </div>
      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setCopied(false);
        }}
        spellCheck={false}
        rows={Math.min(16, Math.max(4, text.split("\n").length + 1))}
        style={{
          width: "100%",
          boxSizing: "border-box",
          background: "#0d111a",
          border: `1px solid ${edited ? accent : T.line}`,
          borderRadius: 7,
          color: T.text,
          fontFamily: T.mono,
          fontSize: 11.5,
          lineHeight: 1.5,
          padding: "9px 11px",
          resize: "vertical",
          outline: "none",
        }}
      />
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

function Head({ T: t, children }: { T: typeof T; children: React.ReactNode }) {
  return <div style={{ marginTop: 18, marginBottom: 2, color: t.dim, fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", fontWeight: 600 }}>{children}</div>;
}

function Section({ T: t, label, children }: { T: typeof T; label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
      <div style={{ color: t.faint, fontSize: 9.5, letterSpacing: 1, textTransform: "uppercase" }}>{label}</div>
      {children}
    </div>
  );
}

function btn(t: typeof T): React.CSSProperties {
  return { background: "transparent", border: `1px solid ${t.line}`, color: t.dim, borderRadius: 5, padding: "3px 9px", cursor: "pointer", fontFamily: t.sans, fontSize: 10, letterSpacing: 0.3 };
}

function Toggle({ on, onClick, label, tone }: { on: boolean; onClick: () => void; label: string; tone: "gold" | "green" }) {
  const c = tone === "green" ? { bg: "#16241a", bd: "#3a5a44", fg: "#9ed3b0" } : { bg: "#221c10", bd: "#5a4a28", fg: T.goldHi };
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        background: on ? c.bg : "transparent",
        border: `1px solid ${on ? c.bd : T.line}`,
        color: on ? c.fg : T.faint,
        borderRadius: 6,
        padding: "5px 6px",
        cursor: "pointer",
        fontFamily: T.sans,
        fontSize: 10.5,
        letterSpacing: 0.4,
      }}
    >
      {label}
    </button>
  );
}

function Slider({ label, v, min, max, step, on }: { label: string; v: number; min: number; max: number; step: number; on: (v: number) => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
      <span style={{ width: 38, color: T.dim, fontSize: 10, flex: "0 0 auto" }}>{label}</span>
      <input type="range" min={min} max={max} step={step} value={v} onChange={(e) => on(parseFloat(e.target.value))} style={{ flex: 1, accentColor: T.gold, minWidth: 0 }} />
      <span style={{ color: T.text, width: 30, textAlign: "right", fontFamily: T.mono, fontSize: 10.5, flex: "0 0 auto" }}>{v.toFixed(2)}</span>
    </div>
  );
}
