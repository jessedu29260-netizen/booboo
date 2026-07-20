# GOALS — what Booboo is for

> Written 2026-07-19 with Jesse. `design/GAPS.md` says what is TRUE today, with
> evidence. This file says where we are GOING and how far each goal actually is.
> When the two disagree, GAPS wins — it is the only doc allowed to say "done".
>
> **Read this first if you are picking the work up cold.** The demo and the
> product are not the same thing, and the distance between them is the point of
> this document.

---

## The headline, stated plainly

**We have built the OUTPUT. The product is the PROCESS.**

The Pemberton Grand is a fully-formed brain — 2,839 nodes, a rule of law that
inherits, 425 reports, three faces. It is a beautiful demonstration of *what a
Booboo brain looks like once it exists*.

Goal 3 below — install it and an orchestrator builds **your** structure — is the
actual promise, and it is close to unbuilt. `create-booboo` today writes a fixed
three-agent stub (`core` → `writer`, `researcher`) identical for every user. It
does not ask, infer, or tailor anything.

That is not a criticism of the demo. You cannot sell the process without first
showing the output. But nobody should mistake one for the other, and the next
phase of work is on the other side of that line.

---

## G1 · A landing page that stops people scrolling

**What it means.** A stranger arrives knowing nothing, is arrested by the
cosmos, understands what this is, and leaves wanting it.

**Ruled 2026-07-19:** the cosmos is **the hook, not a tool**. It exists to stop
the scroll. Legibility is not its job — the board's. That single ruling
resolves a pile of open questions: "I don't know who is what" is no longer a
defect, the two-second test moves to the board, and mobile-as-video stops being
a fallback and becomes legitimate everywhere.

**What exists.** Six sections, live hero, embedded playable graph, the model
taught as five nouns, a working in-page ask against `/mcp`, quickstart.

**What is missing.**
- The page hands you **cosmos → cosmos → board-as-a-link**. The conversion path
  should be **hook → convince → prove**: cosmos stops you, the *board* sells it,
  `/mcp` proves it is real. The board is currently a card in section 02.
- The cosmos should be slower still, and eventually a **pre-rendered loop** —
  more beautiful than realtime (no framerate budget), and it kills the mobile
  hole, the weak-GPU guard and the second WebGL context in one move.
- No OG image: every share renders blank.
- **Mobile has never been checked at all.** If this is the funnel, that is most
  of the traffic.

---

## G2 · A beautiful, workable organigram — the rule of law

**What it means.** Not a chart of the org: the **source** the org is generated
from. `booboo_boot` reads it, rules inherit down it, bucket reach derives from
it. Editing it changes what an agent obeys tomorrow.

**What exists.** The cascade — Standard → Executive → Departments → Staff &
machines — rank named in column headers, orthogonal brass elbows on a measured
SVG plane, light theme, source cards stating their consequence, health as the
card's own edge, a duty line on every role, show-the-law, ledger shelf,
semantic zoom, live vendor marks.

**What is missing.**
- **Workable is the weak word.** Editing is the whole point and the affordances
  are thin: only cards are drop targets, so a near-miss over empty lane space
  silently does nothing, and there is **no per-item undo** — only a global
  discard in the top bar. This is what Jesse hit as "I cannot unlink it".
- The **dossier panel** still carries the pre-light-pivot layout — the most
  visibly unfinished surface in the product.
- The board is light; the cosmos is still blue-black. Our own one-ordering law
  says the faces should agree.
- Two dossier implementations (viewer + panel). CRAFT §4 wants one component.

---

## G3 · Install it, and an orchestrator builds YOUR structure

> **The product. Roughly 40% built** — the intake mechanism exists and is
> verified by running it; it has not yet been run by anyone who isn't me.

**What it means.** Anyone — a person, Claude, any agent — installs Booboo. An
orchestrator is created immediately, interviews or infers the shape of their
work, and generates a tailored organigram: the right departments, the right
roles, the reports each one files, the rules each one inherits. The structure
then flows down to every agent, which boots from it.

**What exists.**
- The *doctrine* is real and shipped: `booboo_boot` returns an agent's identity,
  inherited rules in boot order, bucket reach and children. Roles are durable,
  agents disposable. The org file is a validated, diffable source.
- `create-booboo` scaffolds a runnable brain and **names** an orchestrator.
- **The intake exists** (2026-07-19). The scaffold now ships `ONBOARDING.md` — a
  six-step ritual the user's own agent runs once: read the repo, ask only what
  the repo can't tell you (max 4 questions), propose the tree for correction,
  write `org.booboo.json` + config + rule files, verify against `npm run build`
  and the panel, then close. `org.booboo.json` carries `"seed": true` and
  `AGENTS.md § 0` gates every session on it, so the ritual cannot be silently
  skipped and no work gets built on the placeholder shape.
  **The key architectural call:** the intake is a *document the agent executes*,
  not a CLI wizard. A wizard has to ask everything because it can read nothing;
  the agent already in your folder can read the repo and only ask the rest. It
  also means zero new dependencies and no LLM calls from the CLI.
  *Verified:* scaffold → `npm install` → `npm run build` clean (7 nodes, 0
  orphans, 0 dumps); org validates with the extra field; and the ritual was
  **run against a repo it had never seen** (booboo's own) to check it produces
  something genuinely tailored rather than renamed writer/researcher. It does —
  and running it exposed a flaw now fixed: folders give you a *flat list*, the
  grouping lives in the prose, so a ritual that stopped at directory names would
  emit a root with fifteen children and call it an organigram.

**What is missing.**
- **No generation of depth.** Nothing turns "we're a 12-person agency doing X"
  into duty lines and report cadences — the ritual gets you the *structure*, not
  the populated ledger.
- **No report scaffolding.** The Pemberton's 425 reports were authored by a
  bespoke generator. A new user gets an empty ledger and no cadence.
- **The orchestrator does not orchestrate.** It is a node with a boot string,
  not a running thing that sets anything up.

**The honest sequencing question:** this is a different kind of build — an
authoring/inference product, not a rendering one. It probably starts as a single
`booboo init` conversation that writes an org file, before anything autonomous.

---

## G4 · Forkable UI, and a merge on main reaches everyone
> **Proven end-to-end 2026-07-19.** The full chain ran once for real: bump →
> `pnpm publish` (spec · panel · viewer · create-booboo) → npm → `npm update` in
> Dionisos OS → deploy → the OS renders the current panel over the real 93-agent
> fleet. A merge on main now has a demonstrated path to every host, ours included.
> What remains for the goal is *discipline* (nothing yet forces the bump/publish
> on merge), not capability.

**What it means.** The interface is not welded to our hosting. Any OS or host
mounts it. A fix landed on main propagates to every user — including our own:
**Dionisos OS should render the real Booboo panel**, not its own lookalike.

**What exists.**
- `<Panel />` is a genuinely mountable component with an injectable `api` prop,
  and it now carries its own tokens + styles in one injected stylesheet, so a
  host needs no CSS import. That was proven the hard way this session — the
  panel shipped a palette that resolved to nothing because tokens lived in a
  file no host loaded.
- Seven packages published under `@booboo-brain/*`, per-package semver.
- The viewer is equally mountable and is already embedded in two places.
- **Dionisos OS already mounts the real panel** (2026-07-19 finding, correcting
  the line below that used to say it "renders something else" — it does not).
  `dionisos-graph/src/components/os/OrganigramPage.tsx` renders
  `@booboo-brain/panel` (`ssr:false`, "never a fork"), and
  `/api/booboo/[fn]` + `/api/org` adapt the live Dionisos brain (atlas_snapshot ·
  dionisos_reports · cron_runs · prompt_registry) to the panel's routes. The
  architecture is the correct one: consume from npm, spread on publish.
- **The current panel renders the real 79-agent fleet, and it is excellent** —
  proven this session by running the current panel against the live Dionisos
  brain (`booboo panel --org dionisos.org --snapshot dionisos.booboo.json`):
  the House Standard binding 79, Dionisos with 3,038 memories in reach and 52
  machines it operates, every real bucket in the ledger, the cron fleet as
  automation cards with health dots. Screenshot banked. *This* is what the OS
  will show once the packages are published.

**What is missing — it is narrower than it looked.**
- **Version drift, not a missing mount.** The OS is pinned to `panel ^0.5.2`
  (installed 0.5.2), wired on 2026-07-04 — *before the entire craft pass*. So it
  renders a two-week-old panel: no source cards, no cascade, no health lamps, no
  cadence. Closing it is a **release**, not a build: publish spec + panel + viewer
  + create-booboo (they must ship together — panel and viewer now import `relTime`
  from spec), then `npm update` in the OS and redeploy. Both steps are Jesse-gated
  (npm publish · Dionisos production deploy).
- **The OS adapter's cadence gap is fixed** (branch `booboo-panel-cadence`): every
  org card now declares a real reporting rhythm, so the fleet is not falsely amber
  the moment the new panel lands. Parser verified against all ~60 live crons; tsc
  clean; live render pends the gated deploy.
- **No release discipline** connecting main → npm → hosts, and the root cause is
  now concrete: dozens of commits landed on the packages this session with **no
  version bump**, so npm can never receive them. A merge does not reach anyone
  until someone bumps + publishes.
- **Deploys are manual.** The site is built from a local `web/dist` and pushed by
  hand. It is now *provably* reproducible from the repo (verified by wiping and
  rebuilding: zero drift) but nothing structural prevents that drifting again.
  A build-on-PR action is the fix.
- No versioned embedding contract — a host pinning `^0.5` has no statement of
  what may change under it.

---

## G5 · Trust — nothing is "done" without evidence *(added)*

**Why it belongs here.** This project has repeatedly shipped things that looked
verified and were not: three specified-but-never-built features found by
auditing the spec against source; a dossier reading field names no dataset
emitted; a palette resolving to nothing; a light theme that silently broke dark;
a board reported finished after looking at one tab at one size with animations
disabled. Every one was caught by *looking at the running thing*, never by review.

**The rule, already in force.** `design/GAPS.md` is the only doc that may say
"done", every ✅ carries the evidence that proved it, and it updates in the same
commit as the work.

**What is missing.** Golden-frame CI (the one frame on disk is untracked), a
build-on-PR action, and any check at all below desktop width.

---

## G6 · A path from "impressive" to "paid" *(added)*

**Why it belongs here.** G1 says "stop scrolling", not "convert". FHQ sells the
done-for-you / hosted tier; the OSS core is the funnel. Nothing in the current
demo asks for anything: no email capture, no hosted path, no route for a
non-technical buyer who wants their brain built for them.

The MCP endpoint is the strongest proof we own — *point Claude at it and ask it
anything* — and it is buried in section 05. A prospect who reaches it is far
closer to buying than one who liked the graph.

---

## Sequence — what to do next, in order

1. **G1 · Rebuild the landing around the hand-off.** Hero stops you, the board
   convinces you, `/mcp` proves it. Highest leverage: it is the only surface a
   stranger sees, and it currently sells the wrong face.
2. **G2 · Make the board workable.** Lane-wide drop targets and per-item undo.
   Editing is the point; the affordances are the product.
3. **G1/G5 · Mobile + OG image.** The funnel is unchecked below desktop and every
   share renders blank.
4. **G2 · The dossier panel** — bring it into the light language.
5. **G3 · `booboo init` as a conversation** that writes a real org file. The
   first honest step toward the actual product.
6. **G4 · Dionisos OS mounts the real panel**, and a build-on-PR action.

Items 1–4 finish the demo. Item 5 starts the product. Item 6 proves the
distribution claim on ourselves before we make it to anyone else.
