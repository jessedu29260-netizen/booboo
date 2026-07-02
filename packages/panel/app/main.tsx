import { StrictMode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import type { BOrg, BOrgAgent } from "@booboo-brain/spec";
import { orgBootSlice } from "@booboo-brain/spec";
import "./panel.css";

// THE ORGANIGRAM — the editable half of Booboo. Drag an agent onto a new
// parent, hit apply, and the org FILE changes — next boot, every agent that
// boots from booboo obeys the new shape. The display is the steering wheel.

const api = (path: string, init?: RequestInit) =>
  fetch(`/api${path}`, init).then((r) => (r.ok ? r.json() : r.json().then((b) => Promise.reject(b))));

type Stats = { nodes: number; links: number; byLayer: Record<string, number> };

// Gentle count-up so numbers land, not snap.
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

// One agent card in the tree. Draggable; a drop on it reparents the dragged
// agent under it (cycles blocked before they can happen).
function AgentCard({
  a, depth, isRoot, selected, dragId, onSelect, onDragStart, onDropOn, childCount,
}: {
  a: BOrgAgent;
  depth: number;
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
      style={{ ["--d" as string]: depth }}
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

// Recursive tree render: an agent, then its children indented beneath it.
function Tree({
  org, parent, depth, ...cardProps
}: {
  org: BOrg;
  parent: string | null;
  depth: number;
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
            depth={depth}
            isRoot={a.id === org.root}
            selected={cardProps.selected === a.id}
            dragId={cardProps.dragId}
            onSelect={cardProps.onSelect}
            onDragStart={cardProps.onDragStart}
            onDropOn={cardProps.onDropOn}
            childCount={org.agents.filter((c) => c.parent === a.id).length}
          />
          <div className="tree-kids">
            <Tree org={org} parent={a.id} depth={depth + 1} {...cardProps} />
          </div>
        </div>
      ))}
    </>
  );
}

function Chip({ children, tone }: { children: React.ReactNode; tone?: string }) {
  return <span className={`chip${tone ? ` ${tone}` : ""}`}>{children}</span>;
}

// The dossier: everything one agent is — identity, authority chain, inherited
// rules, buckets, skills — plus live memory/report counts from the snapshot.
function Dossier({ org, id, hasSnapshot }: { org: BOrg; id: string; hasSnapshot: boolean }) {
  const slice = useMemo(() => orgBootSlice(org, id), [org, id]);
  const [memCount, setMemCount] = useState<number | null>(null);
  const [repCount, setRepCount] = useState<number | null>(null);

  useEffect(() => {
    setMemCount(null);
    setRepCount(null);
    if (!hasSnapshot || !slice) return;
    // Conventions: memory nodes → type "memory", cluster = bucket;
    // report nodes → type "report", cluster = agent id.
    Promise.all(
      slice.buckets.map((b) =>
        api(`/nodes?type=memory&cluster=${encodeURIComponent(b)}&limit=1`).then((j) => j.total as number).catch(() => 0),
      ),
    ).then((counts) => setMemCount(counts.reduce((s, n) => s + n, 0)));
    api(`/nodes?type=report&cluster=${encodeURIComponent(id)}&limit=1`)
      .then((j) => setRepCount(j.total))
      .catch(() => setRepCount(0));
  }, [id, hasSnapshot, slice]);

  const mem = useCountUp(memCount ?? 0);
  const rep = useCountUp(repCount ?? 0);

  if (!slice) return null;
  const a = slice.agent;
  const own = new Set(a.rules ?? []);

  return (
    <aside className="doss">
      <div className="doss-head">
        <span className="doss-emoji">{a.emoji || "🤖"}</span>
        <div>
          <h2>{a.name}</h2>
          {a.role && <p className="doss-role">{a.role}</p>}
        </div>
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
          <div className="doss-chips">{slice.buckets.map((b) => <Chip key={b}>{b}</Chip>)}</div>
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
      {!hasSnapshot && (
        <p className="doss-note">start with <code>--snapshot</code> to see live memory + report counts here.</p>
      )}
    </aside>
  );
}

function App() {
  const [saved, setSaved] = useState<BOrg | null>(null); // what's on disk
  const [draft, setDraft] = useState<BOrg | null>(null); // what's on screen
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

  // The draft's divergence from disk, as human sentences — shown before apply.
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
      if (dragId === draft.root) return; // the root doesn't move
      if (isDescendant(draft, targetId, dragId)) return; // no dropping onto your own subtree
      setDraft({
        ...draft,
        agents: draft.agents.map((a) => (a.id === dragId ? { ...a, parent: targetId } : a)),
      });
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
    <div className="pnl" onClick={() => setSelected(null)}>
      <div className="pnl-aurora" aria-hidden />
      <header className="bar" onClick={(e) => e.stopPropagation()}>
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

      {changes.length > 0 && (
        <div className="pending" onClick={(e) => e.stopPropagation()}>
          {changes.map((c) => <span key={c} className="pending-item">{c}</span>)}
        </div>
      )}
      {err && <div className="pnl-err">{err}</div>}

      <div className="body">
        <main className="tree" onClick={(e) => e.stopPropagation()}>
          <p className="tree-hint">drag an agent onto its new parent · click for its dossier</p>
          <Tree
            org={draft}
            parent={null}
            depth={0}
            selected={selected}
            dragId={dragId}
            onSelect={setSelected}
            onDragStart={setDragId}
            onDropOn={dropOn}
          />
        </main>
        {selected && <Dossier org={draft} id={selected} hasSnapshot={!!stats} />}
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
