# NEXT SESSION — Booboo handoff (opened 2026-07-19, Frankie/fractional-hq)

Read `design/GOALS.md` (the spine) and `design/GAPS.md` (the only doc allowed to
say "done"; every ✅ carries its evidence) before starting. Governing rules that
do not bend: **GAPS is the only place "done" lives, and every ✅ ships in the
same commit as the work that earned it; nothing is "done" without an observed
artefact (screenshot / curl / live query), not just a build; and every step is
stopped by "is this making it truly above others?" — if not, iterate.**

## Where things stand (2026-07-19, end of session)
- Demo is live at **https://booboo.fractionalhq.uk** on branch
  `feat/public-demo-site`, **PR #5 open** (merge is Jesse-gated — do not merge).
- **G4 shipped end-to-end:** published `@booboo-brain/spec 0.3.1 · panel 0.5.4 ·
  viewer 0.1.2 · create-booboo 0.5.0`; Dionisos OS (`dionisos-graph`, master,
  Vercel) updated to panel 0.5.4 and deployed. The OS `booboo` tab renders the
  current panel over the real 93-agent fleet. Cadence fix live there.
- **G2 board is workable** (lane-wide drop targets + per-item undo), **G1 landing**
  rebuilt (hook→convince→prove), **G3 onboarding ritual** exists (`ONBOARDING.md`
  in the scaffold), Pemberton data honest (house/executive memory, cadence).
- Verified live this session: the OS render, the cadence lamps, and D5 (theme +
  drag) in Jesse's real browser.

---

## 0. START HERE — the light-colour fix (Jesse named this first)

**Symptom.** In the Dionisos OS `booboo` tab the panel renders **split-brain**:
the document root/body resolve to the **light** theme (`data-theme=light`,
`body` bg `rgb(252,251,249)`) but the **cards render dark** (`.ag` bg
`rgb(13,18,26)`). It is neither cleanly light (the approved design) nor cleanly
dark — it just looks broken. On the demo the same panel 0.5.4 renders correct
light, so the split is specific to the OS embed.

**Diagnosis already done (don't re-derive).**
- `localStorage['booboo-theme-v2']` is null on the `dionisos-graph.vercel.app`
  origin → the panel's `readTheme()` defaults to **light** and sets
  `document.documentElement[data-theme]=light`.
- Yet the cards use dark colours → the panel's own dark card values are winning
  despite `data-theme=light`. Suspects, in order: (a) `OrganigramPage.tsx` wraps
  the panel in `<div style={{background:"#0b0c10"}}>` (dark) — a dark island
  around a light panel; (b) the OS is a dark Next app that manages the document
  root itself, and the panel's `useTheme` fighting the OS's global theme leaves a
  split; (c) `PANEL_CSS` load-order / specificity in the OS build vs the demo.
- **The panel has no `theme` prop** — a host cannot pin the panel's theme; it can
  only rely on `?embed` (forces light), localStorage, or the default.

**Two ways to fix — pick after deciding the design question below.**
- *Quick, OS-only (no republish):* have `OrganigramPage.tsx` set
  `localStorage['booboo-theme-v2']='light'` before the panel mounts (and drop the
  `#0b0c10` wrapper, or make it the light surface). Verify cards go light.
- *Clean, but a panel change + republish:* add a `theme?: "light"|"dark"` prop to
  `<Panel />` so hosts pin it explicitly (`packages/panel/src/Panel.tsx`
  `useTheme`/`readTheme`). This is the right long-term API and it re-exercises the
  whole G4 release chain (see task 2) — good, do both together if you go this way.

**The design question to settle first (ask Jesse if unsure):** the OS is a *dark*
cockpit. A light panel island in it may read wrong. Options: (i) panel light,
accept the island; (ii) panel dark, coherent with the OS — but then it is not the
approved light language; (iii) the OS shell goes light behind the panel. Jesse
asked for "the light fix," so default to (i)/(iii) — the approved design is light
— but confirm the island doesn't look worse than the current split before
shipping. **Verify in Jesse's real browser (D5 rule), both themes, screenshot.**

---

## 1. Cleanup (trivial, do first)
- `dionisos-graph`: branch `booboo-panel-cadence` is merged to master — delete it.

## 2. G4 · Release discipline (the goal's true remainder)
Capability is proven; **nothing forces a bump+publish on merge**, so the OS can
drift stale again (it just did — 2 weeks). Add a changeset/CI publish so a merge
to main bumps the changed packages and publishes. Without it, "a merge reaches
everyone" is a manual ritual. The light fix (if done the clean way) is the first
customer of this. `npm publish` stays Jesse-gated regardless — wire it so the
gate is one approval, not a manual multi-step.

## 3. G1/G5 · Mobile + OG image (distribution blockers — GAPS C8, C9)
- **C8 · OG image (🔴):** every social share of the demo renders blank. Directly
  undercuts the distribution push. Highest-leverage small fix.
- **C9 · Mobile (🔴):** the landing degrades to a CSS starfield; `/viewer/` and
  `/chart/` on a phone are **unverified**, likely poor. The funnel is unchecked
  below desktop. GOALS wants a rendered video loop for mobile hero, a cropped
  still for the board rather than a 17%-scale live app.

## 4. G2 · Finish the board's craft (mostly done — verify/close)
- **Dossier in the light language:** the C27 pass freed the role, killed the
  banned side-stripes, themed the dot. Confirm nothing pre-light-pivot remains;
  it renders light now but give it one honest read against CRAFT.
- **One dossier component (GAPS line ~100, CRAFT §4):** viewer and panel each have
  their own dossier implementation. Consolidate to one shared component.
- **A4/A9 (🟡):** view presets instead of 14 sliders; a d-pad walk; a
  hosted/done-for-you convert path + email capture (no non-technical buyer path).

## 5. G3 · From ritual to product (starts the real product)
- **No external user has run the onboarding ritual** — that is the real test.
- **No generation of depth:** the ritual writes *structure*, not a populated
  ledger. A fresh org has no reports, no duty lines, no cadence beyond what the
  human declares. Pemberton's 425 reports were a bespoke generator. Decide whether
  `booboo init` should scaffold a starter ledger/cadence, and how.

## 6. G5 · Regression safety (GAPS C10, C11, C7)
- **C10 · Golden-frame CI (🔴):** one frame committed, no pixel-diff — design can
  regress silently. Wire the diff.
- **C11 · Scale claim unproven (🟡):** the million-node path has never been
  rendered end-to-end — only asserted. Prove it or soften the claim.
- **C7 · Viewer weak-GPU fallback (🟡):** guarded at the landing only; a stranger
  deep-linking `/viewer/` on a weak device is unprotected.

## 7. Housekeeping (GAPS D-rows)
- **D3 (🔴):** `.secrets/porkbun_credentials.md` still says the key was "LOST AT
  CREATION" — it wasn't (`.env.master` has both). Correct the stale doc.
- The cosmos-vs-board one-ordering question is **decided, not open** (GAPS D6):
  the dark cosmos is load-bearing — flag-finding ranks by emissive luminance, so a
  light ground breaks it. Do not reopen without solving flag-finding on light.

---

## Verification rungs that apply here
UI → run it, screenshot it, click the control, read the console. **Persisted
state / "why does mine look different" → the real browser via claude-in-chrome,
BEFORE asking Jesse to look** (D5). Test the path the user runs, not the
convenient one. The panel/CLI trick for real-data checks:
`node packages/cli/dist/cli.js panel --org <org.json> --snapshot <snap.json>
--port <n> --no-open` then drive it headless over CDP.
