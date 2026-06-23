import { useMemo, useState } from "react";
import type { BoobooGraph, BNode, BLink } from "@booboo/spec";
import { Booboo, defaultCfg, type BoobooCfg } from "./Booboo";
import { usePersisted } from "./usePersisted";

const PANEL = "#0a0d14f2";
const LINE = "#2a2f3a";

// deep-merge a saved/URL cfg over the defaults so newly-added nested keys (sizes, layers) always resolve.
const mergeCfg = (initial: BoobooCfg, s: Partial<BoobooCfg>): BoobooCfg => ({
  ...initial,
  ...s,
  sizes: { ...initial.sizes, ...(s.sizes ?? {}) },
  layers: { ...initial.layers, ...(s.layers ?? {}) },
});
// ?cfg=<urlencoded-json> pins exact settings (wallpaper link) — wins over localStorage. Independent of ?file=.
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

/** Booboo + the full instrument: HUD · click→dossier · a PERSISTENT control panel.
 *  Toggle changes are saved to localStorage (per `persistKey`) and survive reload.
 *  Pass persist={false} for a kiosk/wallpaper surface (always uses the fixed defaults). */
export function BoobooView({
  data,
  persistKey = "booboo-cfg-v2", // bumped: orbit boolean→number is a breaking shape change
  persist = true,
}: {
  data: BoobooGraph;
  persistKey?: string;
  persist?: boolean;
}) {
  const initial = useMemo(() => defaultCfg(data), [data]);
  const [cfg, setCfg, resetCfg] = usePersisted<BoobooCfg>(persistKey, initial, persist, mergeCfg, urlCfg());
  const [sel, setSel] = useState<string | null>(null);

  const byId = useMemo(() => new Map(data.nodes.map((n) => [n.id, n])), [data]);
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const n of data.nodes) c[n.layer] = (c[n.layer] ?? 0) + 1;
    return c;
  }, [data]);
  const node = sel ? byId.get(sel) ?? null : null;
  const layerVisible = (name: string) => cfg.layers[name] !== false;
  const toggleLayer = (name: string) => setCfg((p) => ({ ...p, layers: { ...p.layers, [name]: !layerVisible(name) } }));
  const setSize = (name: string, v: number) => setCfg((p) => ({ ...p, sizes: { ...p.sizes, [name]: v } }));
  const copyWallpaper = () => {
    try {
      void navigator.clipboard?.writeText(`${location.origin}${location.pathname}?cfg=${encodeURIComponent(JSON.stringify(cfg))}`);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div style={{ position: "absolute", inset: 0, background: "#06080e", fontFamily: "ui-monospace, SFMono-Regular, monospace" }}>
      <Booboo data={data} cfg={cfg} onSelect={setSel} />

      {/* HUD */}
      <div style={{ position: "absolute", top: 16, left: 18, pointerEvents: "none" }}>
        <div style={{ color: "#c9a04a", fontSize: 13, letterSpacing: 3, fontWeight: 700 }}>🐾 {data.meta.title ?? "BOOBOO"}</div>
        <div style={{ color: "#6b6451", fontSize: 10, letterSpacing: 1, marginTop: 2 }}>
          {data.nodes.length.toLocaleString()} nodes · {data.links.length.toLocaleString()} links · {data.meta.layers.length} layers
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 8, fontSize: 11 }}>
          {data.meta.layers.map((l) => (
            <span key={l.name} style={{ color: l.color ?? "#aaa", opacity: layerVisible(l.name) ? 1 : 0.35 }}>
              ● {l.label ?? l.name} {(counts[l.name] ?? 0).toLocaleString()}
            </span>
          ))}
        </div>
      </div>

      {node && <Dossier n={node} byId={byId} links={data.links} onClose={() => setSel(null)} onJump={setSel} />}

      {/* PERSISTENT CONTROL PANEL */}
      <div
        style={{
          position: "absolute",
          bottom: 30,
          right: 22,
          width: 224,
          background: "#0a0d14ec",
          border: `1px solid ${LINE}`,
          borderRadius: 6,
          padding: "10px 12px",
          display: "flex",
          flexDirection: "column",
          gap: 7,
          fontSize: 10,
          color: "#6b6451",
          maxHeight: "calc(100vh - 60px)",
          overflowY: "auto",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ color: "#8a8268", letterSpacing: 1 }}>controls · saved</span>
          <button
            onClick={resetCfg}
            style={{ background: "transparent", border: `1px solid ${LINE}`, color: "#6b6451", borderRadius: 3, padding: "2px 7px", cursor: "pointer", fontFamily: "inherit", fontSize: 9 }}
          >
            reset
          </button>
        </div>
        <Toggle on={cfg.lines} onClick={() => setCfg({ lines: !cfg.lines })} label="lines" />
        <Toggle on={cfg.orbit > 0} onClick={() => setCfg({ orbit: cfg.orbit > 0 ? 0 : 1 })} label="✦ spin" />
        <Slider label="◎ spin speed" v={cfg.orbit} min={0} max={2.5} step={0.05} on={(v) => setCfg({ orbit: v })} />
        <Slider label="link" v={cfg.lineOpacity} min={0} max={0.4} step={0.01} on={(v) => setCfg({ lineOpacity: v })} />
        <Slider label="nodes" v={cfg.nodeScale} min={0.3} max={2.5} step={0.05} on={(v) => setCfg({ nodeScale: v })} />
        <div style={{ color: "#4a4438", marginTop: 2 }}>isolate layers</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {data.meta.layers.map((l) => {
            const on = layerVisible(l.name);
            return (
              <button
                key={l.name}
                onClick={() => toggleLayer(l.name)}
                style={{
                  flex: "1 0 44%",
                  background: on ? "#161922" : "transparent",
                  border: `1px solid ${on ? l.color ?? "#888" : LINE}`,
                  color: on ? l.color ?? "#ccc" : "#4a4438",
                  borderRadius: 3,
                  padding: "3px 4px",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontSize: 9,
                  letterSpacing: 0.4,
                }}
              >
                {l.label ?? l.name}
              </button>
            );
          })}
        </div>
        <div style={{ color: "#4a4438", marginTop: 2 }}>node sizes</div>
        {data.meta.layers.map((l) => (
          <Slider key={l.name} label={l.label ?? l.name} v={cfg.sizes[l.name] ?? 1} min={0.2} max={3} step={0.05} on={(v) => setSize(l.name, v)} />
        ))}
        <button
          onClick={copyWallpaper}
          title="copy a link that opens this view with these exact settings"
          style={{ marginTop: 5, background: "transparent", border: `1px solid ${LINE}`, color: "#8a8268", borderRadius: 4, padding: "5px 6px", cursor: "pointer", fontFamily: "inherit", fontSize: 9.5, letterSpacing: 0.5 }}
        >
          ⊕ copy wallpaper link
        </button>
      </div>

      <div style={{ position: "absolute", bottom: 12, left: 18, fontSize: 10, color: "#4a4438", pointerEvents: "none" }}>drag-rotate · scroll zoom · click a node</div>
    </div>
  );
}

function Toggle({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        background: on ? "#1e2a16" : "transparent",
        border: `1px solid ${on ? "#5d8a6e" : LINE}`,
        color: on ? "#9ed3b0" : "#6b6451",
        borderRadius: 4,
        padding: "4px 6px",
        cursor: "pointer",
        fontFamily: "inherit",
        fontSize: 10,
        letterSpacing: 0.5,
      }}
    >
      {label}
    </button>
  );
}

function Slider({ label, v, min, max, step, on }: { label: string; v: number; min: number; max: number; step: number; on: (v: number) => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
      <span style={{ width: 36 }}>{label}</span>
      <input type="range" min={min} max={max} step={step} value={v} onChange={(e) => on(parseFloat(e.target.value))} style={{ flex: 1, accentColor: "#c9a04a" }} />
      <span style={{ color: "#E8DCC4", width: 26, textAlign: "right" }}>{v.toFixed(2)}</span>
    </div>
  );
}

function Dossier({
  n,
  byId,
  links,
  onClose,
  onJump,
}: {
  n: BNode;
  byId: Map<string, BNode>;
  links: BLink[];
  onClose: () => void;
  onJump: (id: string) => void;
}) {
  const rels = useMemo(() => links.filter((l) => l.source === n.id || l.target === n.id).slice(0, 50), [n.id, links]);
  const dataRows = n.data ? Object.entries(n.data).map(([k, v]) => [k, typeof v === "string" ? v : JSON.stringify(v)] as [string, string]) : [];
  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        right: 0,
        width: 340,
        maxWidth: "85%",
        height: "100%",
        background: PANEL,
        borderLeft: `1px solid ${LINE}`,
        backdropFilter: "blur(8px)",
        color: "#E8DCC4",
        padding: "20px 16px",
        overflowY: "auto",
        fontSize: 12,
      }}
    >
      <button onClick={onClose} style={{ position: "absolute", top: 10, right: 12, background: "none", border: "none", color: "#6b6451", cursor: "pointer", fontSize: 16 }}>
        ×
      </button>
      <div style={{ color: "#6b6451", fontSize: 10, letterSpacing: 2, textTransform: "uppercase" }}>
        {n.type} · {n.layer}
      </div>
      <div style={{ fontSize: 17, marginTop: 6, color: "#f5ebd4", wordBreak: "break-word" }}>
        {n.icon ? n.icon + " " : ""}
        {n.label}
      </div>
      <Rows rows={[["id", n.id], ["weight", String(n.weight ?? "—")], ["tier", String(n.tier ?? "—")], ["cluster", n.cluster ?? "—"], ["parent", n.parent ?? "—"]]} />
      {dataRows.length > 0 && (
        <>
          <Head>data</Head>
          <Rows rows={dataRows} />
        </>
      )}
      {rels.length > 0 && (
        <>
          <Head>relations · {rels.length}</Head>
          {rels.map((l, i) => {
            const other = l.source === n.id ? l.target : l.source;
            const o = byId.get(other);
            return (
              <div
                key={i}
                onClick={() => onJump(other)}
                style={{ display: "flex", gap: 8, padding: "3px 0", cursor: "pointer" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#f5ebd4")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#E8DCC4")}
              >
                <span style={{ color: "#6b6451", width: 64, flex: "0 0 auto" }}>{l.type}</span>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o?.label ?? other}</span>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

function Head({ children }: { children: React.ReactNode }) {
  return <div style={{ marginTop: 14, color: "#6b6451", fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase" }}>{children}</div>;
}
function Rows({ rows }: { rows: [string, string][] }) {
  return (
    <div style={{ marginTop: 8 }}>
      {rows.map(([k, v]) => (
        <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "4px 0" }}>
          <span style={{ color: "#6b6451" }}>{k}</span>
          <span style={{ textAlign: "right", wordBreak: "break-word", maxWidth: 220 }}>{v}</span>
        </div>
      ))}
    </div>
  );
}
