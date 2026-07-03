import { StrictMode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import type { BNode, BOrg, BOrgAgent } from "@booboo-brain/spec";
import { orgBootSlice } from "@booboo-brain/spec";
import "./panel.css";

// THE PANEL — Booboo's control plane. Five tabs over one org file + one
// snapshot: ORGANIGRAM (drag-drop hierarchy, the editable half), BUCKETS
// (memory by bucket), REPORTS (the portfolio timeline), RULES (who declares,
// who inherits), GRAPH (the real 3D viewer, embedded). Dossier-first;
// the graph is a lens, not the front door.

const api = (path: string, init?: RequestInit) =>
  fetch(`/api${path}`, init).then((r) => (r.ok ? r.json() : r.json().then((b) => Promise.reject(b))));

type Stats = { nodes: number; links: number; byLayer: Record<string, number> };

const TABS = [
  { id: "org", glyph: "⌂", label: "organigram" },
  { id: "buckets", glyph: "▤", label: "buckets" },
  { id: "reports", glyph: "⏱", label: "reports" },
  { id: "rules", glyph: "§", label: "rules" },
  { id: "graph", glyph: "◉", label: "graph" },
] as const;
type TabId = (typeof TABS)[number]["id"];

function relTime(iso?: unknown): string {
  if (typeof iso !== "string") return "";
  const t = new Date(iso).getTime();
  if (!t) return "";
  const s = (Date.now() - t) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 172800) return "yesterday";
  return `${Math.floor(s / 86400)}d ago`;
}

function useCountUp(target: number, ms = 900): number {
  const [v, setV] = useState(0);
  const fromRef = useRef(0);
  useEffect(() => {
    const from = fromRef.current;
    const t0 = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / ms);
      const eased = 1 - Math.pow(1 - k, 3);
      setV(Math.round(from + (target - from) * eased));
      if (k < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

// #/  ·  #/buckets  ·  #/buckets/<name>  ·  #/reports  ·  #/rules  ·  #/graph
function useRoute(): [TabId, string | null] {
  const parse = (): [TabId, string | null] => {
    const h = window.location.hash.replace(/^#\/?/, "");
    const [tab, ...rest] = h.split("/");
    const known = TABS.some((t) => t.id === tab) ? (tab as TabId) : "org";
    return [known, rest.length ? decodeURIComponent(rest.join("/")) : null];
  };
  const [route, setRoute] = useState(parse);
  useEffect(() => {
    const onHash = () => setRoute(parse());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  return route;
}
const nav = (path: string) => { window.location.hash = path; };

// A steady hue per bucket so each keeps its identity across screens.
function bucketHue(name: string): number {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
}

/* ────────────────────────── ORGANIGRAM ────────────────────────── */

function AgentCard({
  a, isRoot, selected, dragId, onSelect, onDragStart, onDropOn, childCount,
}: {
  a: BOrgAgent;
  isRoot: boolean;
  selected: boolean;
  dragId: string | null;
  onSelect: (id: string) => void;
  onDragStart: (id: string) => void;
  onDropOn: (id: string) => void;
  childCount: number;
}) {
  const [over, setOver] = useState(false);
  return (
    <div
      className={`ag${isRoot ? " root" : ""}${selected ? " sel" : ""}${over ? " over" : ""}${dragId === a.id ? " dragging" : ""}`}
      draggable={!isRoot}
      onClick={(e) => { e.stopPropagation(); onSelect(a.id); }}
      onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; onDragStart(a.id); }}
      onDragOver={(e) => { if (dragId && dragId !== a.id) { e.preventDefault(); setOver(true); } }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); onDropOn(a.id); }}
    >
      <span className="ag-emoji">{a.emoji || "🤖"}</span>
      <span className="ag-name">{a.name}</span>
      {a.role && <span className="ag-role">{a.role}</span>}
      {childCount > 0 && <span className="ag-kids">{childCount}</span>}
    </div>
  );
}

function Tree({
  org, parent, ...cardProps
}: {
  org: BOrg;
  parent: string | null;
  selected: string | null;
  dragId: string | null;
  onSelect: (id: string) => void;
  onDragStart: (id: string) => void;
  onDropOn: (id: string) => void;
}) {
  const kids = org.agents.filter((a) => (parent === null ? a.id === org.root : a.parent === parent));
  return (
    <>
      {kids.map((a) => (
        <div className="tree-branch" key={a.id}>
          <AgentCard
            a={a}
            isRoot={a.id === org.root}
            selected={cardProps.selected === a.id}
            dragId={cardProps.dragId}
            onSelect={cardProps.onSelect}
            onDragStart={cardProps.onDragStart}
            onDropOn={cardProps.onDropOn}
            childCount={org.agents.filter((c) => c.parent === a.id).length}
          />
          <div className="tree-kids">
            <Tree org={org} parent={a.id} {...cardProps} />
          </div>
        </div>
      ))}
    </>
  );
}

function Chip({ children, tone, onClick }: { children: React.ReactNode; tone?: string; onClick?: () => void }) {
  return (
    <span className={`chip${tone ? ` ${tone}` : ""}${onClick ? " tap" : ""}`} onClick={onClick}>
      {children}
    </span>
  );
}

function Dossier({ org, id, hasSnapshot }: { org: BOrg; id: string; hasSnapshot: boolean }) {
  const slice = useMemo(() => orgBootSlice(org, id), [org, id]);
  const [memCount, setMemCount] = useState<number | null>(null);
  const [repCount, setRepCount] = useState<number | null>(null);
  const [reports, setReports] = useState<BNode[] | null>(null);

  useEffect(() => {
    setMemCount(null);
    setRepCount(null);
    setReports(null);
    if (!hasSnapshot || !slice) return;
    Promise.all(
      slice.buckets.map((b) =>
        api(`/nodes?type=memory&cluster=${encodeURIComponent(b)}&limit=1`).then((j) => j.total as number).catch(() => 0),
      ),
    ).then((counts) => setMemCount(counts.reduce((s, n) => s + n, 0)));
    api(`/nodes?type=report&cluster=${encodeURIComponent(id)}&limit=100`)
      .then((j: { total: number; nodes: BNode[] }) => {
        setRepCount(j.total);
        const at = (n: BNode) => String((n.data as Record<string, unknown>)?.at ?? "");
        setReports([...j.nodes].sort((a, b) => at(b).localeCompare(at(a))).slice(0, 4));
      })
      .catch(() => { setRepCount(0); setReports([]); });
  }, [id, hasSnapshot, slice]);

  const mem = useCountUp(memCount ?? 0);
  const rep = useCountUp(repCount ?? 0);

  if (!slice) return null;
  const a = slice.agent;
  const own = new Set(a.rules ?? []);

  return (
    <aside className="doss" onClick={(e) => e.stopPropagation()}>
      <div className="doss-head">
        <span className="doss-emoji">{a.emoji || "🤖"}</span>
        <div>
          <h2>{a.name}</h2>
          {a.role && <p className="doss-role">{a.role}</p>}
        </div>
        {hasSnapshot && (
          <button className="doss-3d" title="see the whole brain in 3D" onClick={() => nav("/graph")}>
            ◉ 3D
          </button>
        )}
      </div>

      <div className="doss-chain">
        {slice.chain.map((c, i) => (
          <span key={c.id}>
            {i > 0 && <i>›</i>}
            <b className={c.id === a.id ? "me" : ""}>{c.name}</b>
          </span>
        ))}
      </div>

      {hasSnapshot && (
        <div className="doss-stats">
          <div className="doss-stat">
            <div className="doss-n">{memCount === null ? "…" : mem.toLocaleString()}</div>
            <div className="doss-l">memories in reach</div>
          </div>
          <div className="doss-stat">
            <div className="doss-n">{repCount === null ? "…" : rep.toLocaleString()}</div>
            <div className="doss-l">reports filed</div>
          </div>
          <div className="doss-stat">
            <div className="doss-n">{slice.children.length}</div>
            <div className="doss-l">direct reports</div>
          </div>
        </div>
      )}

      {hasSnapshot && (
        <section>
          <h3>latest reports</h3>
          {reports === null ? (
            <p className="doss-empty">loading…</p>
          ) : reports.length === 0 ? (
            <p className="doss-empty">no reports filed yet — they appear here as this agent closes work.</p>
          ) : (
            <div className="doss-reps">
              {reports.map((r) => {
                const d = (r.data ?? {}) as Record<string, unknown>;
                return (
                  <div className="doss-rep" key={r.id}>
                    <div className="doss-rep-top">
                      <span className="doss-rep-when">{relTime(d.at) || "undated"}</span>
                      <span className="doss-rep-label">{r.label}</span>
                    </div>
                    {typeof d.summary === "string" && d.summary && <p className="doss-rep-sum">{d.summary}</p>}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      <section>
        <h3>rules · inherited top-down</h3>
        {slice.rules.length === 0 ? (
          <p className="doss-empty">no rules anywhere on this branch yet.</p>
        ) : (
          <ul className="doss-rules">
            {slice.rules.map((r) => (
              <li key={r} className={own.has(r) ? "own" : ""}>
                {r} {!own.has(r) && <em>inherited</em>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3>memory buckets</h3>
        {slice.buckets.length === 0 ? (
          <p className="doss-empty">no bucket access — this agent remembers nothing.</p>
        ) : (
          <div className="doss-chips">
            {slice.buckets.map((b) => (
              <Chip key={b} onClick={() => nav(`/buckets/${encodeURIComponent(b)}`)}>{b} ›</Chip>
            ))}
          </div>
        )}
      </section>

      <section>
        <h3>skills</h3>
        {slice.skills.length === 0 ? (
          <p className="doss-empty">no skills declared.</p>
        ) : (
          <div className="doss-chips">{slice.skills.map((s) => <Chip key={s} tone="alt">{s}</Chip>)}</div>
        )}
      </section>

      {a.boot && (
        <section>
          <h3>boot</h3>
          <p className="doss-boot">{a.boot}</p>
        </section>
      )}
    </aside>
  );
}

function OrgScreen({
  draft, selected, dragId, setSelected, setDragId, dropOn, hasSnapshot,
}: {
  draft: BOrg;
  selected: string | null;
  dragId: string | null;
  setSelected: (id: string | null) => void;
  setDragId: (id: string | null) => void;
  dropOn: (id: string) => void;
  hasSnapshot: boolean;
}) {
  return (
    <div className="body" onClick={() => setSelected(null)}>
      <main className="tree" onClick={(e) => e.stopPropagation()}>
        <p className="tree-hint">drag an agent onto its new parent · click for its dossier</p>
        <Tree
          org={draft}
          parent={null}
          selected={selected}
          dragId={dragId}
          onSelect={setSelected}
          onDragStart={setDragId}
          onDropOn={dropOn}
        />
      </main>
      {selected && <Dossier org={draft} id={selected} hasSnapshot={hasSnapshot} />}
    </div>
  );
}

/* ────────────────────────── BUCKETS ────────────────────────── */

function BucketCount({ bucket }: { bucket: string }) {
  const [n, setN] = useState<number | null>(null);
  useEffect(() => {
    api(`/nodes?type=memory&cluster=${encodeURIComponent(bucket)}&limit=1`)
      .then((j) => setN(j.total))
      .catch(() => setN(0));
  }, [bucket]);
  const v = useCountUp(n ?? 0);
  return <div className="bk-n">{n === null ? "…" : v.toLocaleString()}</div>;
}

function BucketsScreen({ org, param, hasSnapshot }: { org: BOrg; param: string | null; hasSnapshot: boolean }) {
  // bucket → the agents that can reach it (declared or inherited).
  const buckets = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const a of org.agents) {
      const slice = orgBootSlice(org, a.id);
      for (const b of slice?.buckets ?? []) {
        const arr = map.get(b) ?? [];
        arr.push(a.name);
        map.set(b, arr);
      }
    }
    return [...map.entries()].sort((x, y) => x[0].localeCompare(y[0]));
  }, [org]);

  const [items, setItems] = useState<BNode[] | null>(null);
  useEffect(() => {
    setItems(null);
    if (!param || !hasSnapshot) return;
    api(`/nodes?type=memory&cluster=${encodeURIComponent(param)}&limit=200`)
      .then((j: { nodes: BNode[] }) => {
        const at = (n: BNode) => String((n.data as Record<string, unknown>)?.at ?? "");
        setItems([...j.nodes].sort((a, b) => at(b).localeCompare(at(a))));
      })
      .catch(() => setItems([]));
  }, [param, hasSnapshot]);

  if (param) {
    return (
      <div className="screen">
        <button className="pnl-back" onClick={() => nav("/buckets")}>← all buckets</button>
        <h2 className="scr-title">
          <i className="bk-dot" style={{ ["--h" as string]: bucketHue(param) }} /> {param}
        </h2>
        {!hasSnapshot ? (
          <p className="scr-empty">start with <code>--snapshot</code> to browse this bucket's memories.</p>
        ) : items === null ? (
          <p className="scr-empty">loading…</p>
        ) : items.length === 0 ? (
          <p className="scr-empty">this bucket is empty — nothing remembered here yet.</p>
        ) : (
          <div className="mem-list">
            {items.map((m) => {
              const d = (m.data ?? {}) as Record<string, unknown>;
              return (
                <div className="mem-row" key={m.id}>
                  <span className="mem-when">{relTime(d.at) || "—"}</span>
                  <span className="mem-label">{m.label}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="screen">
      <h2 className="scr-title">memory buckets</h2>
      <p className="scr-sub">every bucket in the organigram, who reaches it, and how much lives inside.</p>
      {buckets.length === 0 ? (
        <p className="scr-empty">no buckets declared on any agent yet — add <code>"buckets"</code> to agents in the org file.</p>
      ) : (
        <div className="bk-grid">
          {buckets.map(([b, agents]) => (
            <button className="bk-card" key={b} style={{ ["--h" as string]: bucketHue(b) }} onClick={() => nav(`/buckets/${encodeURIComponent(b)}`)}>
              <div className="bk-top">
                <i className="bk-dot" />
                <span className="bk-name">{b}</span>
              </div>
              {hasSnapshot ? <BucketCount bucket={b} /> : <div className="bk-n dim">—</div>}
              <div className="bk-l">memories</div>
              <div className="bk-agents">{agents.slice(0, 4).join(" · ")}{agents.length > 4 ? ` +${agents.length - 4}` : ""}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ────────────────────────── REPORTS ────────────────────────── */

function ReportsScreen({ org, hasSnapshot }: { org: BOrg; hasSnapshot: boolean }) {
  const [rows, setRows] = useState<BNode[] | null>(null);
  const [who, setWho] = useState<string>("");
  const nameOf = useMemo(() => new Map(org.agents.map((a) => [a.id, a])), [org]);

  useEffect(() => {
    if (!hasSnapshot) return;
    api(`/nodes?type=report&limit=1000`)
      .then((j: { nodes: BNode[] }) => {
        const at = (n: BNode) => String((n.data as Record<string, unknown>)?.at ?? "");
        setRows([...j.nodes].sort((a, b) => at(b).localeCompare(at(a))));
      })
      .catch(() => setRows([]));
  }, [hasSnapshot]);

  const agents = useMemo(() => [...new Set((rows ?? []).map((r) => r.cluster ?? ""))].filter(Boolean), [rows]);
  const shown = (rows ?? []).filter((r) => !who || r.cluster === who);
  const total = useCountUp(shown.length);

  if (!hasSnapshot)
    return <div className="screen"><h2 className="scr-title">reports</h2><p className="scr-empty">start with <code>--snapshot</code> to see the portfolio timeline.</p></div>;

  return (
    <div className="screen">
      <h2 className="scr-title">reports <span className="scr-count">{total}</span></h2>
      <p className="scr-sub">what the fleet has been closing, newest first.</p>
      {agents.length > 1 && (
        <div className="rep-filter">
          <Chip tone={who === "" ? "" : "alt"} onClick={() => setWho("")}>everyone</Chip>
          {agents.map((a) => (
            <Chip key={a} tone={who === a ? "" : "alt"} onClick={() => setWho(who === a ? "" : a)}>
              {nameOf.get(a)?.emoji ?? ""} {nameOf.get(a)?.name ?? a}
            </Chip>
          ))}
        </div>
      )}
      {rows === null ? (
        <p className="scr-empty">loading…</p>
      ) : shown.length === 0 ? (
        <p className="scr-empty">no reports filed yet — they land here as agents close work (node type <code>report</code>).</p>
      ) : (
        <div className="timeline">
          {shown.map((r) => {
            const d = (r.data ?? {}) as Record<string, unknown>;
            const a = r.cluster ? nameOf.get(r.cluster) : undefined;
            return (
              <div className="tl-row" key={r.id}>
                <div className="tl-dot" />
                <div className="tl-body">
                  <div className="tl-top">
                    <span className="tl-agent">{a?.emoji ?? "🤖"} {a?.name ?? r.cluster ?? "unknown"}</span>
                    <span className="tl-when">{relTime(d.at) || "undated"}</span>
                  </div>
                  <div className="tl-label">{r.label}</div>
                  {typeof d.summary === "string" && d.summary && <p className="tl-sum">{d.summary}</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ────────────────────────── RULES ────────────────────────── */

function RulesScreen({ org }: { org: BOrg }) {
  const rules = useMemo(() => {
    const declared = new Map<string, string[]>();
    for (const a of org.agents) for (const r of a.rules ?? []) {
      const arr = declared.get(r) ?? [];
      arr.push(a.id);
      declared.set(r, arr);
    }
    const inherited = new Map<string, string[]>();
    for (const a of org.agents) {
      const own = new Set(a.rules ?? []);
      const slice = orgBootSlice(org, a.id);
      for (const r of slice?.rules ?? []) if (!own.has(r)) {
        const arr = inherited.get(r) ?? [];
        arr.push(a.id);
        inherited.set(r, arr);
      }
    }
    const name = (id: string) => org.agents.find((a) => a.id === id)?.name ?? id;
    return [...declared.entries()]
      .sort((x, y) => x[0].localeCompare(y[0]))
      .map(([r, by]) => ({ rule: r, declaredBy: by.map(name), inheritedBy: (inherited.get(r) ?? []).map(name) }));
  }, [org]);

  return (
    <div className="screen">
      <h2 className="scr-title">rules <span className="scr-count">{rules.length}</span></h2>
      <p className="scr-sub">every rule in the organigram — who declares it, and who lives under it.</p>
      {rules.length === 0 ? (
        <p className="scr-empty">no rules declared yet — add <code>"rules"</code> refs to agents in the org file.</p>
      ) : (
        <div className="rule-list">
          {rules.map((r) => (
            <div className="rule-card" key={r.rule}>
              <div className="rule-ref">{r.rule}</div>
              <div className="rule-meta">
                <span>declared by <b>{r.declaredBy.join(", ")}</b></span>
                {r.inheritedBy.length > 0 && <span>· binds <b>{r.inheritedBy.length}</b> below: {r.inheritedBy.join(", ")}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ────────────────────────── GRAPH ────────────────────────── */

function GraphScreen({ hasSnapshot }: { hasSnapshot: boolean }) {
  if (!hasSnapshot)
    return <div className="screen"><h2 className="scr-title">graph</h2><p className="scr-empty">start with <code>--snapshot graph.json</code> and the 3D brain renders right here.</p></div>;
  return (
    <div className="graph-wrap">
      <iframe className="graph-frame" src="/view/?file=/snapshot.json" title="Booboo 3D brain" />
    </div>
  );
}

/* ────────────────────────── APP ────────────────────────── */

function App() {
  const [tab, param] = useRoute();
  const [saved, setSaved] = useState<BOrg | null>(null);
  const [draft, setDraft] = useState<BOrg | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [err, setErr] = useState("");
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    api("/org")
      .then((o: BOrg) => { setSaved(o); setDraft(o); setSelected(o.root); })
      .catch(() => setErr("Can't load the organigram — is `booboo panel --org` running?"));
    api("/stats").then(setStats).catch(() => setStats(null));
  }, []);

  const changes = useMemo(() => {
    if (!saved || !draft) return [];
    const before = new Map(saved.agents.map((a) => [a.id, a.parent ?? null]));
    const name = (id: string) => draft.agents.find((a) => a.id === id)?.name ?? id;
    const out: string[] = [];
    for (const a of draft.agents) {
      const was = before.get(a.id);
      if (was !== undefined && was !== (a.parent ?? null))
        out.push(`${name(a.id)} → now under ${a.parent ? name(a.parent) : "root"}`);
    }
    return out;
  }, [saved, draft]);

  const isDescendant = useCallback((org: BOrg, maybeChild: string, of: string): boolean => {
    const byId = new Map(org.agents.map((a) => [a.id, a]));
    let cur = byId.get(maybeChild);
    const guard = new Set<string>();
    while (cur?.parent && !guard.has(cur.id)) {
      guard.add(cur.id);
      if (cur.parent === of) return true;
      cur = byId.get(cur.parent);
    }
    return false;
  }, []);

  const dropOn = useCallback(
    (targetId: string) => {
      if (!draft || !dragId || dragId === targetId) return;
      if (dragId === draft.root) return;
      if (isDescendant(draft, targetId, dragId)) return;
      setDraft({ ...draft, agents: draft.agents.map((a) => (a.id === dragId ? { ...a, parent: targetId } : a)) });
      setDragId(null);
    },
    [draft, dragId, isDescendant],
  );

  const apply = useCallback(async () => {
    if (!draft) return;
    setApplying(true);
    setErr("");
    try {
      await api("/org", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft) });
      setSaved(draft);
    } catch (e) {
      setErr(`apply failed: ${(e as { errors?: string[] })?.errors?.join("; ") ?? "unknown error"}`);
    } finally {
      setApplying(false);
    }
  }, [draft]);

  const agentCount = useCountUp(draft?.agents.length ?? 0);
  const nodeCount = useCountUp(stats?.nodes ?? 0, 1200);

  if (err && !draft) return <div className="pnl-fatal">{err}</div>;
  if (!draft) return <div className="pnl-fatal calm">waking the organigram…</div>;

  return (
    <div className="pnl">
      <div className="pnl-aurora" aria-hidden />
      <header className="bar">
        <div className="bar-brand">🐾 <b>{draft.title || "the organigram"}</b></div>
        <div className="bar-stats">
          <span><b>{agentCount}</b> agents</span>
          {stats && <span><b>{nodeCount.toLocaleString()}</b> nodes in the brain</span>}
        </div>
        <div className="bar-actions">
          {changes.length > 0 ? (
            <>
              <span className="bar-draft">{changes.length} unapplied change{changes.length > 1 ? "s" : ""}</span>
              <button className="btn ghost" onClick={() => setDraft(saved)}>discard</button>
              <button className="btn primary" disabled={applying} onClick={apply}>
                {applying ? "applying…" : "apply → org file"}
              </button>
            </>
          ) : (
            <span className="bar-ok">● in sync with the org file</span>
          )}
        </div>
      </header>

      <nav className="tabs">
        {TABS.map((t) => (
          <button key={t.id} className={`tab${tab === t.id ? " on" : ""}`} onClick={() => nav(`/${t.id === "org" ? "" : t.id}`)}>
            <span className="tab-glyph">{t.glyph}</span> {t.label}
          </button>
        ))}
      </nav>

      {changes.length > 0 && tab === "org" && (
        <div className="pending">
          {changes.map((c) => <span key={c} className="pending-item">{c}</span>)}
        </div>
      )}
      {err && <div className="pnl-err">{err}</div>}

      <div className="content" key={tab + (param ?? "")}>
        {tab === "org" && (
          <OrgScreen
            draft={draft}
            selected={selected}
            dragId={dragId}
            setSelected={setSelected}
            setDragId={setDragId}
            dropOn={dropOn}
            hasSnapshot={!!stats}
          />
        )}
        {tab === "buckets" && <BucketsScreen org={draft} param={param} hasSnapshot={!!stats} />}
        {tab === "reports" && <ReportsScreen org={draft} hasSnapshot={!!stats} />}
        {tab === "rules" && <RulesScreen org={draft} />}
        {tab === "graph" && <GraphScreen hasSnapshot={!!stats} />}
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
