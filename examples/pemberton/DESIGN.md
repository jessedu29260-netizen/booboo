# The Pemberton Grand — demo brain design

> Status: DESIGN (ratified in-session 2026-07-18, Jesse + Frankie/Fable brainstorm).
> This document is the spec for the public demo dataset. It replaces `synth()`
> as the front door of the hosted demo. Build order and open verifications at
> the bottom — read those before authoring any file.

## What this demo is

Not a hotel org chart in 3D. **A visible operating system.** The Pemberton
Grand (fictional five-star house; any resemblance to a certain Park Lane
institution is affectionate coincidence) runs on agents: every role has a
personalised AI agent. Each agent **boots from the graph** (identity,
authority chain, inherited rules in boot order, bucket reach), **works
scoped** (Housekeeping's agent sees Housekeeping's buckets and files, not
Finance's), and **closes back into the graph** (`booboo_remember`,
`booboo_report`).

The pitch is the trinity — one brain that is simultaneously:

| Pillar | At the Pemberton | Shipped primitive |
|---|---|---|
| Structure | who exists, who reports to whom | snapshot + org hierarchy |
| Memory | everything the house has learned, bucketed & walled | buckets + journal writes |
| Law | what each agent obeys, declared once, inherited down | org rules, `booboo_boot` |

Everything demonstrated is shipped capability (`booboo_boot` / `_org` /
`_remember` / `_report`, panel authority chart, vault dossiers, privacy
walls). The demo makes it visible; it does not invent features.

**The two-second test (acceptance criterion for the whole build):** a
stranger, two seconds after load, can say what this organisation is, how it
is structured, and where the problem is. Node count appears nowhere in the
test. Scale is a property ("it also holds at a million"), never the pitch.

## Bands (Z, top → bottom)

| Z | key | rim label | contents |
|---|---|---|---|
| apex | `standard` | — (no disc) | THE HOUSE STANDARD — lone contract glyph |
| 4 | `gm` | `GOLD · GENERAL MANAGER` | 1 badge: the GM's agent |
| 3 | `executive` | `SILVER · DEPARTMENT HEADS` | 9 head-agent badges, each with its SOP contract glyph orbiting |
| 2 | `staff` | `BRONZE · STAFF AGENTS` | ~50 named-role agents (tier 2) + generated rosters (tier 3) |
| 1 | `ledger` | `THE LEDGER · MEMORY` | 12 bucket hubs + dense field: observations AND documents |

Design notes:
- Department SOPs are glyphs **beside their head badge**, not a separate
  rules band. Law renders where it is declared. The House Standard is the
  lone apex.
- Documents (rotas, menus, floor plans, supplier contracts) are canonical
  nodes in the LEDGER band, **owned by buckets**. "Access to specific
  files" = bucket reach. No second access mechanism.

## Sectors (angle) — nine departments

Front Office · F&B · Housekeeping · Engineering · Spa & Leisure · Events &
Banqueting · Security · Finance & Procurement · People & Culture.

Layout law (ported from the cosmos analysis, see `WHY_LEGIBLE` notes in the
layout PR): **angle = enumeration index over this sorted fixed list** (never
a hash) · **radius = constant per band** · **the same sector angle on every
band**, so each department reads as one vertical column, head → staff →
bucket. Scatter diameter within a cluster stays below inter-centroid
spacing. No force simulation; deterministic; seeded.

## Agents are roles, not people

Badges read `GM`, `HOUSEKEEPING`, `F&B` — the human is the principal, the
node is their agent. No invented human names anywhere. Persona is dossier
flavour (`desc`): e.g. Housekeeping — "Precise, spares no linen, escalates
before apologising." Each agent's dossier shows: persona · chain of command
· inherited rules **in boot order** (Standard → dept SOP → role contract) ·
bucket reach · children.

Staff (tier 2, ~5-7 per dept, real hotel roles): Night Porter, Concierge,
Guest Relations · Head Chef, Sommelier, Chef de Rang, Room Service ·
Floor Supervisors, Laundry, Minibar · Lift Engineer, HVAC, Night Engineer,
Pool Plant · Therapist Rota, Pool Attendant · Wedding Coordinator, AV,
Banqueting Supervisor · Night Watch, CCTV, Key Custody · Procurement,
Payables, **Night Audit** · Rota, Training, Recruitment.
Rosters (Room Attendant 01–24 etc.) are generated tier-3: small, unlabelled
until selected.

**The Night Audit agent** (Finance, runs 03:00) is the crons-in-the-graph
story, hotel-native. Give it `cadence` and `lastRun`.

## Buckets & walls

| bucket | reach |
|---|---|
| `ledger:house` | all agents read |
| `ledger:<dept>` ×9 | department reads/writes; head owns |
| `ledger:executive` | GM + heads |
| `ledger:guest-registry` | **SEALED** — node visible, contents never emitted |

The sealed bucket is the privacy-walls feature demonstrated correctly: show
the wall, never the secrets. Also `ledger:incidents` (cross-dept append)
feeding the flag system, if it doesn't overcrowd — decide at authoring.

## Verbs (edge types → dossier groups)

`reports_to` (spine/hierarchy) · `declares` (head→SOP, gm→Standard) ·
`amends` (GM→Standard — the "GM modifies it down" authority, unique) ·
`inherits` (agent→each rule binding it) · `owns` / `reads` (agent→bucket) ·
`escalates_to` (staff→head, head→head, head→GM) · `covers` (staff↔staff
shift) · `supplies` (Procurement→dept) · `audits` (Night Audit→buckets).

Edge budget follows the cosmos culling lesson: semantic edges drawn only
where an endpoint is tier ≤ 1; everything else exists in data for the
dossier but is not rendered. Observations link to their bucket via `parent`
(position), not rendered edges; "logged N" is a dossier count.

**Enforcement honesty (for all public copy):** journal writes are genuinely
per-agent-scoped today. Org amendment authority (`amends`) is data +
git-versioned validation — a governance model, not a cryptographic ACL.
Show the model; never overclaim enforcement.

## Flags — one per failure class, all findable by eye

| flag | example | teaches |
|---|---|---|
| 🔴 critical | water leak, Room 407 | live incident (the trace seed) |
| 🟠 overdue | lift inspection past due (Engineering) | deadline drift → dept amber |
| 🟡 stale | Spa pool-attendant agent, no boot 12d | dark agent detection |
| ⚪ orphan | supplier contract no bucket owns | ingestion-quality gate |

Engineering runs amber (lift + 2 rooms OOS). Everything else green. A demo
where everything is green teaches nothing; flags must outrank labels in the
declutter pass and read at default zoom.

## The 30-second trace (staged; data first, choreography later)

1. Room-attendant agent logs the Room 407 leak → obs node born in
   `ledger:housekeeping` (bottom of the Housekeeping column)
2. Housekeeping head `escalates_to` Engineering — pulse crosses sectors at
   the silver band
3. Engineering flips amber→red — the flag finds the eye
4. GM `amends` the House Standard (§ water-damage response) — apex glyph
   pulses
5. The amendment cascades down every `inherits` edge, every column
6. The Night Audit's 03:00 run files the report — timeline entry

Memory write → flow up → flag → law change → law flows down → boots change.
Every pillar in six beats. Stage 1 ships the trace as *static data* (edges,
flags, journal entries all present); choreographed animation is a later
slice.

## Scale posture

Default load ≈ **2,400 nodes** (1 standard + 1 GM + 9 heads + 9 SOPs + ~52
staff + rosters + 12 buckets + ~180 documents + ~2,100 recent observations)
— the readable brain, and the front door. The million is a toggle: "12
years of ledger", generated in-browser with the same sectors/bands so the
structure survives at 1M. Readability is the product; scale is a property.

## The three faces (ruling 2026-07-18: keep graph AND organigram, add ask)

One brain, three projections — never competitors:

| face | surface | answers | ships as |
|---|---|---|---|
| SEE | 3D cosmos (viewer) | shape · flags · flow — the two-second test | demo front door |
| GOVERN | organigram (panel pkg) | hierarchy · rules · bucket reach — **the harness** | "Open the chart" — mount panel's dist-app at /chart/ against the Pemberton org (same hosting trick as viewer; verify panel builds standalone) |
| ASK | Claude over MCP | anything — "top 3 failures this week?", "who's been off sick most in 5 years?" | shown transcript + copy-paste MCP config |

Doctrine lines this encodes:
- **Roles are durable, agents are disposable.** The org defines role + rules +
  buckets + boot order before any agent exists; whatever model boots into the
  role becomes it. New hire = new node. This is the "harness for existing and
  future agents."
- **Claude IS the query language.** No BI layer: MCP tools + reasoning do the
  aggregation. True of the shipped tools today.
- **Bake the answers in.** The generated journal must make the flagship ASK
  questions truly answerable: plant exactly 3 major incidents in the current
  week; plant one staff agent with a chronic absence pattern across 5 years;
  give every obs structured data fields (kind, date, subject). The README's
  "connect it and ask it this" must actually work.
- The hotel thesis, Jesse's words: "a company truly run by AI." That is the
  copy direction for the site H1 rewrite (build step 6) — comprehension +
  operation, not scale.

## Where it lives

```
examples/pemberton/
  DESIGN.md              ← this file
  generate.mjs           ← deterministic, seeded; emits both artifacts
  org.pemberton.booboo.json      (authority: agents, buckets, rules)   [schema TBV]
  pemberton.booboo.json          (snapshot: the graph)
  journal.seed.jsonl             (pre-seeded remember/report entries)  [format TBV]
```

The hosted demo's default route loads the Pemberton snapshot instead of
`?n=` synth. The README gains the copy-paste boot demo:
`booboo mcp --snapshot pemberton.booboo.json --org org.pemberton.booboo.json`
then `booboo_boot("agent:housekeeping")` — the boot slice IS the marketing.

## Open verifications — do these BEFORE authoring (do not fabricate)

1. **Org file schema**: read `packages/panel` + `SPEC.md` org section +
   `serve`'s org handling. Field names above marked TBV. The session that
   designed this never read the org schema.
2. **Journal format**: read how `booboo_remember` persists ("appended to
   the journal beside the snapshot") before seeding it.
3. Confirm `BNode.data` is the right carrier for demo-only fields (persona,
   cadence, flags) vs. first-class fields.

## Build order (unchanged, dataset slots in at 5)

1. `layout.ts` axis decoupling (Z=category, angle=enumerated cluster,
   radius=const/band; bloom default 0)
2. Flags + health (the "where's the problem" half of the two-second test)
3. Directional flow + verb-coloured edges
4. Interaction: dossier-by-verb, `/` search, d-pad walk, focus-on-node,
   breadcrumb (the last two are where we beat the cosmos)
5. **This dataset**
6. Site + README copy rewritten off comprehension, not scale — before
   merging the demo PR
