# NEXT SESSION — Booboo + Fractional HQ handoff (opened 2026-07-20, Frankie)

Read `design/GOALS.md` (the spine) and `design/GAPS.md` (the only doc allowed to
say "done"; every ✅ carries its evidence) before starting. For website work also
read `Fractional HQ/DESIGN.md` and `Fractional HQ/PRODUCT.md`.

**Rules that do not bend:** GAPS is the only place "done" lives, and every ✅
ships in the same commit as the work that earned it, carrying an *observed*
artefact — screenshot, curl, live query — never just a passing build. Every step
is stopped by "is this truly above others?" If not, iterate.

---

## Where things stand (swept 2026-07-20, not remembered)

- **3 repos** (`booboo`, `dionisos-graph`, `Fractional HQ`): 0 uncommitted, in
  sync, one branch each. `Fractional HQ` is now a git repo with a `.gitleaks.toml`
  and a pre-commit hook.
- **7/7 npm packages** local == registry: `panel 0.5.6 · serve 0.4.1 · cli 0.5.1 ·
  spec 0.3.1 · viewer 0.1.2 · build 0.2.0 · vault 0.1.1`.
- **6 live surfaces** all 200. CI + Release green on `booboo/main`.
- **G4 is CLOSED.** Changesets + a release pipeline, armed with an `NPM_TOKEN`
  (valid to ~October). A PR touching `packages/*/src|app|templates` fails CI
  without a changeset; merging to main opens a Version PR; merging *that*
  publishes. The publish gate is now **one approval**, not a manual ritual.
- The landing page had a full craft pass: palette unified with `/booboo`, video
  uncropped and 14.3MB → 6.6MB, a cream inversion on the evidence section, a
  **live run log** and a **document plate** as real artefacts, terminal costume
  removed.

---

## READ THIS BEFORE YOU TRUST A SCREENSHOT

This cost real time three ways in one session, and twice I acted on a false
reading before catching it.

**Jesse's Chrome tab is frequently hidden/minimised.** A hidden tab:

- suspends `requestAnimationFrame`, so **GSAP tweens freeze mid-flight** and
  count-ups stick at whatever frame they reached. I read "39" where the truth was
  "87", and diagnosed a *nonexistent* blank-hero production bug — then deployed a
  "fix" for it before catching that the bug was my own measurement;
- leaves the **compositor serving stale frames**, so a section can be verifiably
  cream in `getComputedStyle` and photograph as solid black.

So:

1. Check `document.visibilityState` **first**. If `hidden`, no screenshot from
   that tab is evidence.
2. For anything a visitor sees, use **headless Chrome** with
   `--force-prefers-reduced-motion` (lands animations instantly).
3. For colour, read **computed style**, not pixels.
4. Scroll-reveals are GSAP-driven. To inspect a section, **isolate** it
   (`body>section:not(#x){display:none}`) rather than scrolling to it.

Same family: **an override that matches nothing looks exactly like one that
works** (GAPS C23). Today `.compare th.fleet-col` (0,2,1) silently outranked a
`.truth` override (0,2,0). Verify specificity by querying computed style.

---

## The work, in order

### 1 · C8 — OG image 🔴 **start here**

Every social share of **both** `booboo.fractionalhq.uk` and `fractionalhq.uk`
renders blank. Smallest item on the list and it directly undercuts the
distribution push. Use the real product as the image, not a logo card.

### 2 · C9 — Mobile 🔴

**The funnel is completely unverified below desktop.** `/viewer/` and `/chart/`
on a phone have never been looked at once. GOALS wants the mobile hero to be a
**pre-rendered video loop** rather than live WebGL — that also closes the
weak-GPU hole (C7) and removes a second WebGL context in one move. Check the
landing, viewer, chart and the new run-log panel at 390px.

### 3 · C10 — Golden-frame CI 🔴

One frame committed, no pixel diff, so design can regress silently. **A template
already exists:** `scripts/check-vendored-index.mjs` (added 2026-07-20) is the
same shape — probe, compare, fail loudly — and it was proven by deliberately
breaking it. Do that for frames.

### 4 · A4 — One dossier component 🔴

Viewer and panel each carry their own implementation. Duplicated implementations
drifting silently has now produced **two** false ✅s: `relTime` (C29) and the
vendored index (C33 — which shipped "0 memories" to every OSS user for weeks).
This is the same class, already loaded and waiting.

### 5 · A3 — The 30-second trace 🔴

Data is present; there is no choreography, no trigger, no UI. The biggest
unbuilt piece of the cosmos, and the thing that would make the viewer *tell a
story* rather than merely render one.

### 6 · C11 — Million-node claim 🟡

Asserted, never rendered end to end. **Prove it or soften the copy.** An unproven
number on a trust-led site is a liability, and trust is this site's entire pitch.

### 7 · G3 — the actual product, and the one that matters

Everything above is polish on something that already impresses. G3 is the
distance between a demo and a business:

- the onboarding ritual writes **structure but no depth** — no populated ledger,
  no report cadence;
- **the orchestrator does not orchestrate** — it is a node with a boot string;
- **no external user has ever run it.** That is the real test and it has not
  happened.

Decide whether `booboo init` should scaffold a starter ledger and cadence, and
how. This is an authoring/inference build, not a rendering one.

---

## Gates — do not cross without Jesse

`npm publish` (the pipeline reduces this to one approval: merge the Version PR) ·
Dionisos production deploy · DNS · anything that spends · customer-facing email ·
Reddit posts.

## Standing constraints that must survive future edits

The landing page's run log is safe **because of three things**, all recorded in
`Fractional HQ/DESIGN.md`. Re-read that section before touching the endpoint:

1. `fhq_telemetry`'s **7-project allowlist is load-bearing** — `cron_runs` also
   carries a `trading-bot` project that must never reach a public page.
2. **`error` and `metadata` are never selected** — stack traces / arbitrary jsonb.
3. The painter uses **`textContent`, never `innerHTML`** (remote data → DOM).

The public anon key has **no public SELECT anywhere**; the run log works through a
`SECURITY DEFINER` RPC behind an edge function. Keep it that way.
