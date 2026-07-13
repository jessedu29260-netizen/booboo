# 🐾 Booboo Panel — spec (v1)

> **This doc predates what actually shipped and does not match it.** The panel that
> exists today is the **Organigram** — five tabs (organigram · buckets · reports ·
> rules · graph) over `org.booboo.json` + a snapshot — documented in the main
> [README.md](../README.md#the-organigram--run-your-agents-like-a-company) and
> implemented in `packages/panel/src/Panel.tsx`. Everything below (Home/Memory/
> Prompts/Sessions/MCP screens) is an earlier, unbuilt direction — read it as
> **roadmap ideas**, not current behaviour.

> The graph gets the applause; the dossier gets the renewal.

Everyone in this space ships a force-graph. Nobody ships the boring, workable
control plane people actually live in: search, lists, dossiers, diffs. The
Panel is Booboo's second consumer — **dossier-first, graph-second** — built on
the exact same snapshot + REST/MCP layer the viewer already consumes. The 3D
brain stays as the wow lens; the Panel is where the work happens.

**Design target:** a solo operator running Claude Code / Cursor / a local agent
stack, five minutes of patience, zero infra. Local-first, read-mostly,
single-user. If a screen needs a login or a cloud, it doesn't belong in v1.

---

## 1 · What people hand-roll today (the demand, ranked)

| # | Pain | Evidence | Panel answer |
|---|------|----------|--------------|
| 1 | **"Why does my agent believe X?"** — memory is opaque; no search, no provenance, no delete | users end up in raw SQLite/pg browsers | Memory screen: search-first list → dossier w/ provenance + neighbors |
| 2 | **CLAUDE.md / AGENTS.md drift** — instructions scattered across repos + global layers, silently shadowing each other; no diff, no single view | every team reinvents a "prompt repo" | Prompts screen: scan → layered tree → drift diff → sync patch |
| 3 | **Unreadable transcripts** — Claude Code writes JSONL nobody can read; cost invisible | new "session viewer" repos weekly | Sessions screen: list → readable transcript → cost rollups |
| 4 | **MCP blindness** — which servers are configured where (desktop config vs `~/.claude.json` vs project `.mcp.json`), which are dead, tool bloat | debugged blind, every time | MCP screen: inventory + health probe + tool counts |
| 5 | **Automation opacity** — what's scheduled, what ran, what failed | nothing exists locally | v2 (needs a runs source; don't fake it) |

Non-goals (deliberate): chat UI (crowded; drags in providers/keys), agent
orchestration (write-heavy, different trust model), team/cloud features,
editing memories *at the source* (v1 writes are an overlay — see §4).

---

## 2 · Architecture — one new package, two new adapters

```
                       ┌── @booboo-brain/viewer   (3D lens — unchanged)
snapshot (brain.json) ─┤
                       └── @booboo-brain/panel    (NEW — the control plane SPA)
                              │ consumes serve's REST verbs + new /panel/* verbs
adapters (build):
  postgres / json            (existing)
  claude-scan     (NEW)  →  prompts layer: every CLAUDE.md/AGENTS.md/.claude/**.md
                            in configured roots + ~/.claude, with content hash
  claude-sessions (NEW)  →  sessions layer: ~/.claude/projects/*/*.jsonl index
                            (id, cwd, started, turns, cost, preview — not bodies)
mcp inventory: runtime probe in serve (not an adapter — freshness matters)
```

- `booboo panel` = new CLI subcommand: serve REST + the panel SPA on one port
  (lazy-loaded like every other subcommand). `booboo up` (roadmap) bundles
  build + serve + panel + viewer.
- The panel is a prebuilt static SPA shipped in the package (same ethos as
  `booboo view`): no build step for the user, opens in the browser.
- Everything renders from the **snapshot** except two live things: MCP health
  probes and session transcript bodies (read from disk on demand via
  `/panel/sessions/:id` — bodies never bloat the snapshot).

## 3 · Screens (v1)

1. **Home — "the brief."** Counts that matter, not a dashboard zoo: memories by
   layer · prompt files found + **drift alerts** ("CLAUDE.md differs in 3 of 7
   repos") · sessions this week + spend · MCP servers up/down. Every number is
   a link into its screen. Honest empty states ("no prompts scanned yet — add
   a root in booboo.config.yaml") — never a blank page.
2. **Memory.** Search box first (serve's index already does this), results as a
   list; click → **dossier**: content, layer, source ref (table/row/file that
   produced it — provenance is the killer field), created/updated, neighbors
   (one hop, as a *list*, with a "see in 3D" deep-link into the viewer focused
   on that node), pin/note/hide actions (overlay, §4).
3. **Prompts.** The wedge feature. Tree of every instruction file found, grouped
   by root, with the **effective layering** shown (global ~/.claude → project →
   scoped) the way the agent actually resolves it. Same-named files across
   repos are hash-compared → **drift view**: side-by-side diff, "last synced"
   note. v1 sync = generate a copy-paste patch (or `booboo prompts sync --from
   <canonical>` dry-run first); never silently overwrite.
4. **Sessions.** List (project · when · turns · cost · preview), filterable.
   Click → readable transcript (user/assistant turns, collapsed tool cards —
   the JSONL decoding is a known-solved problem). Rollups: spend per project
   per week.
5. **MCP.** Inventory across the three config locations with the shadowing
   explained, per-server: transport, command, tool count, last probe result
   (spawn → initialize → tools/list with a hard timeout → up/slow/dead).
   The "you have 478 tools loaded" number, finally visible.
6. **Graph.** The existing viewer, embedded as a tab — entered from dossiers
   ("see in 3D") rather than as the front door.

## 4 · Writes — the overlay journal (v1's only mutation)

Sources stay read-only (the walls promise survives). Panel writes go to a
sidecar `panel.overlay.json` next to the snapshot: `{node_id: {pinned, note,
hidden, at}}`. serve applies the overlay at read time; build preserves it
across rebuilds by id. Deleting at the source is a v2 conversation per adapter
— never a default.

## 5 · Build order

| M | Ship | Proof |
|---|------|-------|
| M1 | panel package + Home + Memory (snapshot-only, zero new adapters) | works on any existing brain.json day one |
| M2 | claude-scan adapter + Prompts screen w/ drift diff | run on the Dionisos vault: must surface real drift |
| M3 | claude-sessions adapter + Sessions screen | decode a real ~/.claude tree incl. space-named dirs |
| M4 | MCP inventory + health probe | correctly reports one deliberately-broken server |
| M5 | overlay writes (pin/note/hide) | survives a rebuild |

Each milestone is sellable alone; M2 is the marketing beat ("see your CLAUDE.md
drift in one command").

## 6 · Quality bar

Wine-dark-calibre visual polish but **its own identity** (Booboo is a product,
not the Dionisos OS): one accent, generous spacing, real typography, dark
default. Phone-usable read paths. Every list virtualized (the 1M-node ethos
applies to lists too). No spinner longer than a probe timeout. Empty states
teach the next step.
