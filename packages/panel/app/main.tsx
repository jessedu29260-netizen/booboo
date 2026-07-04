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

// Timestamps vary by adapter — accept the common field names; "" = undated.
function nodeAt(n: BNode): string {
  const d = (n.data ?? {}) as Record<string, unknown>;
  for (const k of ["at", "ts", "time", "created_at", "date", "bst", "ts_bst", "finished_at"]) {
    const v = d[k];
    if (typeof v === "string" && v) return v;
  }
  return "";
}

// ── HEALTH — reports are the heartbeat ─────────────────────────────────────
// Recency-weighted: the LATEST report decides the light. green: latest ok and
// fresh · amber: latest was a warn, or silent past ~2× cadence · red: latest
// failed · gray: never reported. Older failures inside the window never tint
// the light — they only add a subtle "recent instability" ring on the dot.
type Pulse = { lastAt: string; lastStatus: string; n: number; fails: number };
type HealthMap = Map<string, Pulse>;
type Light = "ok" | "warn" | "fail" | "none";

function buildHealthMap(nodes: BNode[]): HealthMap {
  const m: HealthMap = new Map();
  for (const r of nodes) {
    if (!r.cluster) continue;
    const d = (r.data ?? {}) as Record<string, unknown>;
    // Only rows with an explicit status are heartbeats. Close-notes/decisions
    // carry none — defaulting them to ok let one overwrite a run's verdict.
    if (typeof d.status !== "string") continue;
    const status = d.status;
    const at = nodeAt(r);
    const cur = m.get(r.cluster) ?? { lastAt: "", lastStatus: "", n: 0, fails: 0 };
    cur.n++;
    if (status === "fail") cur.fails++;
    if (at >= cur.lastAt) { cur.lastAt = at; cur.lastStatus = status; }
    m.set(r.cluster, cur);
  }
  return m;
}

function pulseFor(a: BOrgAgent, health: HealthMap | null): Pulse | null {
  if (!health) return null;
  const keys = [a.id, ...(a.buckets ?? [])];
  let best: Pulse | null = null;
  for (const k of keys) {
    const p = health.get(k);
    if (p && (!best || p.lastAt > best.lastAt)) best = p;
  }
  return best;
}

function lightFor(a: BOrgAgent, health: HealthMap | null): Light {
  const p = pulseFor(a, health);
  if (!p || !p.lastAt) return "none";
  if (p.lastStatus === "fail") return "fail";
  const ageH = (Date.now() - new Date(p.lastAt).getTime()) / 3600e3;
  const cadence = typeof a.cadence === "number" && a.cadence > 0 ? a.cadence : 26;
  if (ageH > cadence * 2) return "warn";
  if (p.lastStatus === "warn") return "warn";
  return "ok";
}

// Green but with failures earlier in the window — recovered, worth a glance.
function unstableFor(a: BOrgAgent, health: HealthMap | null): boolean {
  return lightFor(a, health) === "ok" && (pulseFor(a, health)?.fails ?? 0) > 0;
}

const worst = (ls: Light[]): Light =>
  ls.includes("fail") ? "fail" : ls.includes("warn") ? "warn" : ls.includes("ok") ? "ok" : "none";

function nodeSummary(n: BNode): string {
  const d = (n.data ?? {}) as Record<string, unknown>;
  for (const k of ["summary", "title", "detail"]) {
    const v = d[k];
    if (typeof v === "string" && v && v !== n.label) return v;
  }
  return "";
}

// "What the agent closed" lives as type `report` — or `decision` in systems
// that record decisions. Both count; query both and merge, newest first.
// The server caps a page at 1000, so page by offset up to `limit` — truncation
// here once dropped the newest runs and froze stale FAIL lights on the chart.
async function fetchReports(cluster: string | null, limit = 500): Promise<{ total: number; nodes: BNode[] }> {
  const q = async (t: string) => {
    try {
      const base = `/nodes?type=${t}${cluster ? `&cluster=${encodeURIComponent(cluster)}` : ""}`;
      const first = await api(`${base}&limit=${limit}`);
      const nodes: BNode[] = first.nodes ?? [];
      const want = Math.min(first.total ?? 0, limit);
      while (nodes.length < want) {
        const page = await api(`${base}&limit=${limit}&offset=${nodes.length}`);
        if (!page.nodes?.length) break;
        nodes.push(...page.nodes);
      }
      return { total: first.total ?? 0, nodes };
    } catch { return { total: 0, nodes: [] as BNode[] }; }
  };
  const [r, d] = await Promise.all([q("report"), q("decision")]);
  const nodes = [...(r.nodes ?? []), ...(d.nodes ?? [])].sort((a: BNode, b: BNode) => nodeAt(b).localeCompare(nodeAt(a)));
  return { total: (r.total ?? 0) + (d.total ?? 0), nodes };
}

function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

const REDUCED = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

function useCountUp(target: number, ms = 900): number {
  const [v, setV] = useState(REDUCED ? target : 0);
  const fromRef = useRef(0);
  useEffect(() => {
    if (REDUCED) { setV(target); return; } // land instantly — also keeps screenshots honest
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
  a, isRoot, depth, order, selected, dragId, onSelect, onDragStart, onDropOn, childCount, light = "none",
}: {
  a: BOrgAgent;
  isRoot: boolean;
  depth: number;
  order: number;
  selected: boolean;
  dragId: string | null;
  onSelect: (id: string) => void;
  onDragStart: (id: string) => void;
  onDropOn: (id: string) => void;
  childCount: number;
  light?: Light;
}) {
  const [over, setOver] = useState(false);
  const nBuckets = a.buckets?.length ?? 0;
  const nSkills = a.skills?.length ?? 0;
  return (
    <div
      className={`ag${isRoot ? " root" : ""}${selected ? " sel" : ""}${over ? " over" : ""}${dragId === a.id ? " dragging" : ""}`}
      style={{ ["--h" as string]: bucketHue(a.id), ["--d" as string]: depth, animationDelay: `${Math.min(depth * 70 + order * 45, 600)}ms` }}
      draggable={!isRoot}
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(a.id); } }}
      onClick={(e) => { e.stopPropagation(); onSelect(a.id); }}
      onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; onDragStart(a.id); }}
      onDragOver={(e) => { if (dragId && dragId !== a.id) { e.preventDefault(); setOver(true); } }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); onDropOn(a.id); }}
    >
      {light !== "none" && <i className={`ag-light ${light}`} title={`fleet health: ${light}`} />}
      <span className="ag-ava">{a.emoji || "🤖"}</span>
      <span className="ag-name">{a.name}</span>
      <span className="ag-role">{a.role || " "}</span>
      <span className="ag-meta">
        {nBuckets > 0 && <em title="memory buckets">▤ {nBuckets}</em>}
        {nSkills > 0 && <em title="skills">✦ {nSkills}</em>}
        {childCount > 0 && <span className="ag-kids" title="direct reports">{childCount} reports</span>}
      </span>
    </div>
  );
}

// A real company chart: the root on top, branches fanning out beneath, with
// connector lines drawn in CSS (vertical drop → horizontal bar → drops).
function ChartNode({
  org, a, depth, order, ...cardProps
}: {
  org: BOrg;
  a: BOrgAgent;
  depth: number;
  order: number;
  selected: string | null;
  dragId: string | null;
  health: HealthMap | null;
  onSelect: (id: string) => void;
  onDragStart: (id: string) => void;
  onDropOn: (id: string) => void;
}) {
  // Automations are machines this node OPERATES, not org units — they render
  // as a compact TRAY of chips under the owner's card (with health lights),
  // never as full org cards.
  const kids = org.agents.filter((c) => c.parent === a.id && c.kind !== "automation");
  const machines = (() => {
    const out: BOrgAgent[] = [];
    const walk = (pid: string) => {
      for (const c of org.agents.filter((x) => x.parent === pid && x.kind === "automation")) {
        const hasKids = org.agents.some((x) => x.parent === c.id);
        if (hasKids) walk(c.id);
        else out.push(c);
      }
    };
    walk(a.id);
    return out;
  })();
  const lights = machines.map((m) => lightFor(m, cardProps.health));
  const trayLight = worst(lights);
  const TRAY_MAX = 8;
  const hidden = machines.length - TRAY_MAX;
  const hiddenBad = machines.slice(TRAY_MAX).reduce(
    (n, m) => n + (lightFor(m, cardProps.health) !== "ok" && lightFor(m, cardProps.health) !== "none" ? 1 : 0),
    0,
  );
  return (
    <div className="ocn">
      <AgentCard
        a={a}
        isRoot={a.id === org.root}
        depth={depth}
        order={order}
        selected={cardProps.selected === a.id}
        dragId={cardProps.dragId}
        onSelect={cardProps.onSelect}
        onDragStart={cardProps.onDragStart}
        onDropOn={cardProps.onDropOn}
        childCount={kids.length}
        light={trayLight}
      />
      {machines.length > 0 && (
        <div className={`oc-tray ${trayLight}`}>
          {machines.slice(0, TRAY_MAX).map((m) => (
            <button
              key={m.id}
              type="button"
              className={`oc-mac${cardProps.selected === m.id ? " sel" : ""}`}
              title={`${m.name}${m.role ? ` — ${m.role}` : ""}`}
              onClick={(e) => { e.stopPropagation(); cardProps.onSelect(m.id); }}
            >
              <i className={`mac-dot ${lightFor(m, cardProps.health)}${unstableFor(m, cardProps.health) ? " unstable" : ""}`} />
              <span className="mac-emoji">{m.emoji || "⚙️"}</span>
              <span className="mac-name">{m.name}</span>
            </button>
          ))}
          {hidden > 0 && (
            <button
              type="button"
              className="oc-mac more"
              title="open the full machine list in the dossier"
              onClick={(e) => { e.stopPropagation(); cardProps.onSelect(a.id); }}
            >
              +{hidden} machines{hiddenBad > 0 ? ` · ${hiddenBad} not green` : ""}
            </button>
          )}
        </div>
      )}
      {kids.length > 0 && (
        <>
          <div className="oc-down" />
          {/* ≤4 children: the classic fan with connector bars. More: a compact
              grid block that grows DOWN instead of spreading the page sideways. */}
          <div className={`oc-row${kids.length > 4 ? " wrap" : ""}`}>
            {kids.map((k, i) => (
              <div className="oc-child" key={k.id} style={{ ["--h" as string]: bucketHue(k.id) }}>
                <ChartNode org={org} a={k} depth={depth + 1} order={i} {...cardProps} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Chip({ children, tone, onClick }: { children: React.ReactNode; tone?: string; onClick?: () => void }) {
  return (
    <span className={`chip${tone ? ` ${tone}` : ""}${onClick ? " tap" : ""}`} onClick={onClick}>
      {children}
    </span>
  );
}

// The dossier: everything one agent is — and where you EDIT it. Edits land in
// the draft; the top-bar apply writes them to the org file.
function Dossier({
  org, id, hasSnapshot, onUpdate, onAdd, onRemove, onSelect, health = null,
}: {
  org: BOrg;
  id: string;
  hasSnapshot: boolean;
  onUpdate: (id: string, patch: Partial<BOrgAgent>) => void;
  onAdd: (parentId: string) => void;
  onRemove: (id: string) => void;
  onSelect: (id: string) => void;
  health?: HealthMap | null;
}) {
  const slice = useMemo(() => orgBootSlice(org, id), [org, id]);

  // The machines this agent operates — automation leaves anywhere in its
  // automation subtree (grouping nodes like a "fleet" flatten away).
  const autos = useMemo(() => {
    const out: BOrgAgent[] = [];
    const walk = (pid: string) => {
      for (const c of org.agents.filter((x) => x.parent === pid && x.kind === "automation")) {
        const hasKids = org.agents.some((x) => x.parent === c.id);
        if (hasKids) walk(c.id);
        else out.push(c);
      }
    };
    walk(id);
    return out;
  }, [org, id]);
  const [memCount, setMemCount] = useState<number | null>(null);
  const [repCount, setRepCount] = useState<number | null>(null);
  const [reports, setReports] = useState<BNode[] | null>(null);
  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});

  useEffect(() => { setEdit(false); }, [id]);

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
    fetchReports(id, 100).then(({ total, nodes }) => {
      setRepCount(total);
      setReports(nodes.slice(0, 4));
    });
  }, [id, hasSnapshot, slice]);

  const mem = useCountUp(memCount ?? 0);
  const rep = useCountUp(repCount ?? 0);

  const startEdit = () => {
    if (!slice) return;
    const ag = slice.agent;
    setForm({
      name: ag.name ?? "",
      emoji: ag.emoji ?? "",
      role: ag.role ?? "",
      boot: ag.boot ?? "",
      rules: (ag.rules ?? []).join(", "),
      skills: (ag.skills ?? []).join(", "),
      buckets: (ag.buckets ?? []).join(", "),
    });
    setEdit(true);
  };

  const saveEdit = () => {
    const list = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);
    onUpdate(id, {
      name: form.name.trim() || slice?.agent.name || id,
      emoji: form.emoji.trim() || undefined,
      role: form.role.trim() || undefined,
      boot: form.boot.trim() || undefined,
      rules: list(form.rules),
      skills: list(form.skills),
      buckets: list(form.buckets),
    });
    setEdit(false);
  };

  if (!slice) return null;
  const a = slice.agent;
  const isRoot = a.id === org.root;
  const own = new Set(a.rules ?? []);

  return (
    <aside className="doss" onClick={(e) => e.stopPropagation()}>
      <div className="doss-head">
        <span className="doss-emoji">{a.emoji || "🤖"}</span>
        <div>
          <h2>{a.name} {a.kind === "automation" && <span className="auto-badge">automation</span>}</h2>
          {a.role && <p className="doss-role">{a.role}</p>}
        </div>
        <div className="doss-head-actions">
          {!edit && (
            <button className="doss-3d" title="edit this agent" onClick={startEdit}>✎ edit</button>
          )}
          {hasSnapshot && (
            <button className="doss-3d" title="see the whole brain in 3D" onClick={() => nav("/graph")}>◉ 3D</button>
          )}
        </div>
      </div>

      {edit && (
        <div className="doss-edit">
          <div className="doss-edit-row2">
            <label>name<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
            <label className="narrow">emoji<input value={form.emoji} onChange={(e) => setForm({ ...form, emoji: e.target.value })} /></label>
          </div>
          <label>role<input value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} placeholder="one line — what this agent is for" /></label>
          <label>rules <em>comma-separated refs · inherited by everyone beneath</em>
            <input value={form.rules} onChange={(e) => setForm({ ...form, rules: e.target.value })} placeholder="rules/GLOBAL.md, rules/CONTENT.md" />
          </label>
          <label>memory buckets <em>comma-separated</em>
            <input value={form.buckets} onChange={(e) => setForm({ ...form, buckets: e.target.value })} placeholder="shared, content" />
          </label>
          <label>skills <em>comma-separated</em>
            <input value={form.skills} onChange={(e) => setForm({ ...form, skills: e.target.value })} placeholder="humanizer, deep-research" />
          </label>
          <label>boot prompt
            <textarea rows={3} value={form.boot} onChange={(e) => setForm({ ...form, boot: e.target.value })} placeholder="who this agent is, first thing every session" />
          </label>
          <div className="doss-edit-actions">
            <button className="btn primary" onClick={saveEdit}>save to draft</button>
            <button className="btn ghost" onClick={() => setEdit(false)}>cancel</button>
          </div>
        </div>
      )}

      {a.kind === "automation" && (() => {
        const p = pulseFor(a, health);
        const l = lightFor(a, health);
        return (
          <div className={`doss-health ${l}`}>
            <i className={`mac-dot ${l}`} />
            <b>
              {l === "ok" ? "healthy" : l === "fail" ? "last run failed" : l === "warn" ? "stale or degraded" : "no runs recorded"}
            </b>
            {p?.lastAt && <span>last run {relTime(p.lastAt)}</span>}
            {p && p.n > 0 && <span>{Math.round(((p.n - p.fails) / p.n) * 100)}% ok of {p.n}</span>}
            {typeof a.cadence === "number" && <span>expected every {a.cadence}h</span>}
          </div>
        );
      })()}

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
            <div className="doss-n">{slice.children.filter((c) => c.kind !== "automation").length}</div>
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
                const when = relTime(nodeAt(r));
                const sum = nodeSummary(r);
                return (
                  <div className="doss-rep" key={r.id}>
                    <div className="doss-rep-top">
                      {when && <span className="doss-rep-when">{when}</span>}
                      <span className="doss-rep-label">{r.label}</span>
                    </div>
                    {sum && <p className="doss-rep-sum">{sum}</p>}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {autos.length > 0 && (
        <section>
          <h3>automations · {autos.length} — machines this agent operates</h3>
          <div className="doss-autos">
            {autos.map((m) => {
              const p = pulseFor(m, health);
              return (
                <button className="doss-auto" key={m.id} onClick={() => onSelect(m.id)}>
                  <i className={`mac-dot ${lightFor(m, health)}${unstableFor(m, health) ? " unstable" : ""}`} />
                  <span className="doss-auto-emoji">{m.emoji || "⚙️"}</span>
                  <span className="doss-auto-name">{m.name}</span>
                  {m.role && <span className="doss-auto-role">{m.role}</span>}
                  {p?.lastAt && <span className="doss-auto-when">{relTime(p.lastAt)}</span>}
                </button>
              );
            })}
          </div>
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

      {a.boot && !edit && (
        <section>
          <h3>boot</h3>
          <p className="doss-boot">{a.boot}</p>
        </section>
      )}

      <div className="doss-foot">
        <button className="btn ghost" onClick={() => onAdd(id)}>＋ add agent under {a.name}</button>
        {!isRoot && (
          <button className="btn danger" onClick={() => onRemove(id)}>− remove {a.name}</button>
        )}
      </div>
    </aside>
  );
}

function OrgScreen({
  draft, selected, dragId, setSelected, setDragId, dropOn, hasSnapshot, onUpdate, onAdd, onRemove,
}: {
  draft: BOrg;
  selected: string | null;
  dragId: string | null;
  setSelected: (id: string | null) => void;
  setDragId: (id: string | null) => void;
  dropOn: (id: string) => void;
  hasSnapshot: boolean;
  onUpdate: (id: string, patch: Partial<BOrgAgent>) => void;
  onAdd: (parentId: string) => void;
  onRemove: (id: string) => void;
}) {
  // The heartbeat: one fetch of every report powers all the lights.
  const [health, setHealth] = useState<HealthMap | null>(null);
  useEffect(() => {
    if (!hasSnapshot) return;
    fetchReports(null, 10000).then(({ nodes }) => setHealth(buildHealthMap(nodes))).catch(() => {});
  }, [hasSnapshot]);

  const root = draft.agents.find((a) => a.id === draft.root);
  return (
    <div className="body" onClick={() => setSelected(null)}>
      <main className="tree" onClick={(e) => e.stopPropagation()}>
        <p className="tree-hint">drag an agent onto its new parent · click for its dossier · machine trays show live health</p>
        <div className="chart">
          {root && (
            <ChartNode
              org={draft}
              a={root}
              depth={0}
              order={0}
              selected={selected}
              dragId={dragId}
              health={health}
              onSelect={setSelected}
              onDragStart={setDragId}
              onDropOn={dropOn}
            />
          )}
        </div>
      </main>
      {selected && (
        <Dossier
          org={draft}
          id={selected}
          hasSnapshot={hasSnapshot}
          onUpdate={onUpdate}
          onAdd={onAdd}
          onRemove={onRemove}
          onSelect={setSelected}
          health={health}
        />
      )}
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
  // Discovered clusters from the snapshot — buckets that exist in the data even
  // if no agent declares them. Nothing gets to hide from the buckets screen.
  const [discovered, setDiscovered] = useState<Record<string, number> | null>(null);
  useEffect(() => {
    if (!hasSnapshot) { setDiscovered({}); return; }
    api("/clusters?type=memory").then((j) => setDiscovered(j.clusters ?? {})).catch(() => setDiscovered({}));
  }, [hasSnapshot]);

  // bucket → the agents that can reach it (declared or inherited), UNION the
  // discovered set (agent-less buckets render as "unassigned").
  const buckets = useMemo(() => {
    const map = new Map<string, BOrgAgent[]>();
    for (const a of org.agents) {
      const slice = orgBootSlice(org, a.id);
      for (const b of slice?.buckets ?? []) {
        const arr = map.get(b) ?? [];
        arr.push(a);
        map.set(b, arr);
      }
    }
    for (const b of Object.keys(discovered ?? {})) if (!map.has(b)) map.set(b, []);
    return [...map.entries()].sort(
      (x, y) =>
        (y[1].length ? 1 : 0) - (x[1].length ? 1 : 0) ||
        (discovered?.[y[0]] ?? 0) - (discovered?.[x[0]] ?? 0) ||
        x[0].localeCompare(y[0]),
    );
  }, [org, discovered]);

  const [items, setItems] = useState<BNode[] | null>(null);
  useEffect(() => {
    setItems(null);
    if (!param || !hasSnapshot) return;
    api(`/nodes?type=memory&cluster=${encodeURIComponent(param)}&limit=500`)
      .then((j: { nodes: BNode[] }) => {
        setItems([...j.nodes].sort((a, b) => nodeAt(b).localeCompare(nodeAt(a))));
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
            {items.slice(0, 150).map((m) => {
              const when = relTime(nodeAt(m));
              return (
                <div className="mem-row" key={m.id}>
                  {when && <span className="mem-when">{when}</span>}
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
          {buckets.map(([b, agents], i) => (
            <button
              className="bk-card"
              key={b}
              style={{ ["--h" as string]: bucketHue(b), animationDelay: `${i * 70}ms` }}
              onClick={() => nav(`/buckets/${encodeURIComponent(b)}`)}
            >
              <div className="bk-top">
                <i className="bk-dot" />
                <span className="bk-name">{b}</span>
              </div>
              {hasSnapshot ? <BucketCount bucket={b} /> : <div className="bk-n dim">—</div>}
              <div className="bk-l">memories</div>
              {agents.length > 0 ? (
                <>
                  <div className="bk-crew">
                    {agents.slice(0, 7).map((a) => (
                      <span className="bk-face" key={a.id} title={a.name}>{a.emoji || "🤖"}</span>
                    ))}
                    {agents.length > 7 && <span className="bk-more">+{agents.length - 7}</span>}
                  </div>
                  <div className="bk-agents">{agents.slice(0, 3).map((a) => a.name).join(" · ")}{agents.length > 3 ? ` +${agents.length - 3}` : ""}</div>
                </>
              ) : (
                <div className="bk-agents unassigned">unassigned — no agent declares this bucket; add it to an agent's buckets to claim it</div>
              )}
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
    fetchReports(null, 1000)
      .then(({ nodes }) => setRows(nodes))
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
          {shown.slice(0, 100).map((r) => {
            const a = r.cluster ? nameOf.get(r.cluster) : undefined;
            const when = relTime(nodeAt(r));
            const sum = nodeSummary(r);
            return (
              <div className="tl-row" key={r.id} style={{ ["--h" as string]: bucketHue(r.cluster ?? "x") }}>
                <div className="tl-dot" />
                <div className="tl-body">
                  <div className="tl-top">
                    <span className="tl-ava">{a?.emoji ?? "🤖"}</span>
                    <span className="tl-agent">{a?.name ?? r.cluster ?? "unknown"}</span>
                    {when && <span className="tl-when">{when}</span>}
                  </div>
                  <p className="tl-sum">{sum || r.label}</p>
                </div>
              </div>
            );
          })}
          {shown.length > 100 && <p className="scr-empty">showing the latest 100 of {shown.length}.</p>}
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
      .map(([r, by]) => ({
        rule: r,
        global: by.includes(org.root),
        declaredBy: by.map(name),
        inheritedBy: (inherited.get(r) ?? []).map(name),
      }));
  }, [org]);
  const maxBind = Math.max(1, org.agents.length - 1);

  return (
    <div className="screen">
      <h2 className="scr-title">rules <span className="scr-count">{rules.length}</span></h2>
      <p className="scr-sub">every rule in the organigram — who declares it, and who lives under it.</p>
      {rules.length === 0 ? (
        <p className="scr-empty">no rules declared yet — add <code>"rules"</code> refs to agents in the org file.</p>
      ) : (
        <div className="rule-list">
          {rules.map((r, i) => (
            <div className="rule-card" key={r.rule} style={{ animationDelay: `${i * 60}ms` }}>
              <div className="rule-top">
                <span className="rule-ref">{r.rule}</span>
                {r.global && <span className="rule-scope">global — binds everyone</span>}
              </div>
              <div className="rule-meta">
                <span>declared by <b>{r.declaredBy.join(", ")}</b></span>
                {r.inheritedBy.length > 0 && <span> · binds <b>{r.inheritedBy.length}</b> below: {r.inheritedBy.join(", ")}</span>}
              </div>
              <div className="rule-bar">
                <i style={{ width: `${Math.round((r.inheritedBy.length / maxBind) * 100)}%` }} />
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

  const [totals, setTotals] = useState<{ mem: number; rep: number } | null>(null);

  useEffect(() => {
    api("/org")
      .then((o: BOrg) => { setSaved(o); setDraft(o); setSelected(o.root); })
      .catch(() => setErr("Can't load the organigram — is `booboo panel --org` running?"));
    api("/stats").then(setStats).catch(() => setStats(null));
    Promise.all([
      api("/nodes?type=memory&limit=1").then((j) => j.total as number),
      fetchReports(null, 1).then((r) => r.total),
    ])
      .then(([mem, rep]) => setTotals({ mem, rep }))
      .catch(() => setTotals(null));
  }, []);

  const changes = useMemo(() => {
    if (!saved || !draft) return [];
    const before = new Map(saved.agents.map((a) => [a.id, a]));
    const after = new Map(draft.agents.map((a) => [a.id, a]));
    const name = (id: string) => after.get(id)?.name ?? before.get(id)?.name ?? id;
    const noParent = ({ parent: _p, ...rest }: BOrgAgent) => rest;
    const out: string[] = [];
    for (const a of draft.agents) {
      const b = before.get(a.id);
      if (!b) { out.push(`＋ ${a.name} under ${a.parent ? name(a.parent) : "root"}`); continue; }
      if ((b.parent ?? null) !== (a.parent ?? null)) out.push(`${a.name} → now under ${a.parent ? name(a.parent) : "root"}`);
      if (JSON.stringify(noParent(b)) !== JSON.stringify(noParent(a))) out.push(`✎ ${a.name} edited`);
    }
    for (const b of saved.agents) if (!after.has(b.id)) out.push(`− ${b.name} removed`);
    return out;
  }, [saved, draft]);

  // Tweakability — every field of every agent, plus add/remove, all draft-side.
  const updateAgent = useCallback((id: string, patch: Partial<BOrgAgent>) => {
    setDraft((d) => (d ? { ...d, agents: d.agents.map((a) => (a.id === id ? { ...a, ...patch } : a)) } : d));
  }, []);

  const addAgent = useCallback(
    (parentId: string) => {
      if (!draft) return;
      const nm = window.prompt("Name for the new agent:");
      if (!nm || !nm.trim()) return;
      const base = slugify(nm) || "agent";
      let newId = base;
      let i = 2;
      while (draft.agents.some((a) => a.id === newId)) newId = `${base}-${i++}`;
      setDraft({ ...draft, agents: [...draft.agents, { id: newId, name: nm.trim(), emoji: "🤖", parent: parentId }] });
      setSelected(newId);
    },
    [draft],
  );

  const removeAgent = useCallback(
    (id: string) => {
      if (!draft || id === draft.root) return;
      const ag = draft.agents.find((a) => a.id === id);
      if (!ag) return;
      const parentName = draft.agents.find((a) => a.id === ag.parent)?.name ?? "the root";
      const kids = draft.agents.filter((a) => a.parent === id).length;
      if (!window.confirm(`Remove ${ag.name}?${kids ? ` Its ${kids} direct report${kids > 1 ? "s" : ""} move up to ${parentName}.` : ""}`)) return;
      setDraft({
        ...draft,
        agents: draft.agents.filter((a) => a.id !== id).map((a) => (a.parent === id ? { ...a, parent: ag.parent ?? draft.root } : a)),
      });
      setSelected(ag.parent ?? draft.root);
    },
    [draft],
  );

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
  const memTotal = useCountUp(totals?.mem ?? 0, 1100);
  const repTotal = useCountUp(totals?.rep ?? 0, 1300);

  if (err && !draft) return <div className="pnl-fatal">{err}</div>;
  if (!draft) return <div className="pnl-fatal calm">waking the organigram…</div>;

  return (
    <div className="pnl">
      <div className="pnl-aurora" aria-hidden />
      <header className="bar">
        <div className="bar-brand">🐾 <b>{draft.title || "the organigram"}</b></div>
        <div className="bar-stats">
          <span><b>{agentCount}</b> agents</span>
          {stats && <span><b>{nodeCount.toLocaleString()}</b> nodes</span>}
          {totals && <span onClick={() => nav("/buckets")} className="tap"><b>{memTotal.toLocaleString()}</b> memories</span>}
          {totals && <span onClick={() => nav("/reports")} className="tap"><b>{repTotal.toLocaleString()}</b> reports</span>}
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
            onUpdate={updateAgent}
            onAdd={addAgent}
            onRemove={removeAgent}
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
