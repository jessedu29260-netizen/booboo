# GAPS — what is actually true, right now

> The specs (`CRAFT.md`, `examples/pemberton/DESIGN.md`) say what we INTEND.
> This file says what EXISTS, verified by looking at the live thing. It is the
> only doc that may claim "done".
>
> **Law:** no surface gets called finished anywhere — commit message, PR body,
> chat — unless it has a row here marked ✅ with the evidence that proved it.
> Update this file in the same commit as the work. A gap discovered and not
> written here is a gap that will be rediscovered later at higher cost.
>
> Live: https://booboo.fractionalhq.uk · Audited 2026-07-18.

## Legend

✅ done + verified · 🟡 exists, incomplete · 🔴 missing · ⬜ not started

---

## A · SPEC vs SHIPPED — every commitment in CRAFT.md, checked in code

The first version of this file audited the visitor journey and **not the spec**,
which is how a whole slice went missing unnoticed. Checked by grepping the
source, not by memory.

### A0 · Tokens (CRAFT §0 — "single source, three consumers")

| Commitment | State | Reality |
|---|---|---|
| `tokens.json` consumed by site | 🔴 | Not imported. Values hardcoded in `styles.css`. |
| …by viewer | 🔴 | Not imported. Hardcoded in `Booboo.tsx` / `BoobooView.tsx`. |
| …by panel | 🟡 | Values *copied* into `panel.css` by hand; the file is referenced only in a comment. |

**Rule zero says "if it isn't a token it doesn't ship" — and the token file is
currently decorative.** Any palette change today means editing three places.

### A1 · The luminance ladder (CRAFT §1) — the top three ranks are missing

Declared order: `flags > badges > pulses > landmarks > field > edges > discs > bg`.

| Rank | State | Reality |
|---|---|---|
| flags | 🔴 | **Not rendered anywhere.** Dataset has 4 flags + 10 health values; the viewer draws none. Only a code comment mentions them. |
| badges/contracts | 🟡 | Landmarks are brass objects ✅ but carry no icon, no name plate, no contract distinction. |
| pulses | 🟡 | Edges pulse, but uniformly — no direction, no meaning. |
| landmarks / field / discs / bg | ✅ | Built and verified. |

**This is the forgotten slice.** The half of the two-second test that asks
*"where is the problem"* has no implementation at all. Engineering runs amber
in the data and looks identical to every other department on screen.

### A2 · Scene (CRAFT §2)

| Commitment | State |
|---|---|
| Landmarks as brass objects + contact shadows | ✅ |
| Observatory floors: glass, etched rules, engraved names | ✅ |
| Sprite field: soft core, rim, depth fade | ✅ |
| **Light-shaft spines** (cone beams, *authority as light falling*) | 🔴 **the signature element, never built** |
| Edges: fat ribbons, source→target gradient, directional dashes | 🔴 thin GL lines |
| **Verb → token colour on edges** | 🔴 **0 of 397 links carry colour** — every relation looks the same |
| Atmosphere: height fog, nebula IBL | 🟡 starfield only |
| Focus = torch (dim non-neighbourhood) | ✅ |
| Focus = DoF/bokeh rack | 🔴 |
| Camera dolly-to-node on select | 🔴 |

### A3 · Motion (CRAFT §3)

| Commitment | State |
|---|---|
| Entrance: discs → spines → field, skippable, reduced-motion | ✅ |
| Flags ignite **last** so the eye lands on the problem | 🔴 depends on flags existing |
| **The 30-second trace (Act 2)** | 🔴 data present, **no choreography, no trigger, no UI** |

### A4 · Chrome (CRAFT §4)

| Commitment | State |
|---|---|
| Dossier: verb-grouped relations | ✅ |
| Concierge palette — find mode | ✅ |
| Palette — **ask mode** (routes to `/mcp`) | 🔴 |
| **Four view presets** instead of fourteen sliders | 🔴 still fourteen sliders |
| Dossier as **one shared component** (viewer + panel + site) | 🔴 two separate implementations |
| Loading / error / empty states | 🔴 |

### A5 · Organigram (CRAFT §5)

| Commitment | State |
|---|---|
| House tokens applied | ✅ |
| Department columns in cosmos sector order | ✅ |
| Engraved cards on brass rails, orthogonal elbows | 🔴 |
| Card content: persona · health chip · bucket chips · rule count · last report | 🟡 partial in dossier, not on cards |
| **"Show the law" inheritance overlay** | 🔴 |
| Ledger shelf (hover a role → its reach lights) | 🔴 |
| Semantic zoom (house → department → role) | 🔴 |

### A6 · Micro-brand + site (CRAFT §6/§7)

| Commitment | State |
|---|---|
| Copy rewritten to the agent-OS story | ✅ |
| Pemberton crest / "Est. 1927" / white-label proof | 🔴 |
| **Scrollytelling** (scroll chapters drive camera presets) | 🔴 static sections |
| Mobile: rendered video loop | 🔴 |
| OG image | 🔴 |
| Analytics events | 🔴 |

### A7 · Governance (CRAFT §9)

| Commitment | State |
|---|---|
| Golden frames committed | 🟡 one, of five |
| CI pixel-diff | 🔴 |
| Per-PR design QA checklist | 🔴 |

---

## B · The visitor journey (the conversion path)

The honest test: a stranger arrives knowing nothing. Can they understand the
product, play with it, and want it — without installing?

| # | Step | State | Reality |
|---|---|---|---|
| A1 | Land, grasp the pitch | ✅ | Hero + live brain behind it. Copy and scene agree. |
| A2 | See the brain | ✅ | `/viewer/` renders the Pemberton. |
| A3 | **Know what they're looking at** | 🔴 | **No orientation.** No legend of what the bands mean, no "click a department", no guided first move. The HUD lists layer counts; the bottom line says "drag to rotate". Neither teaches the model. A stranger sees a pretty object, not a system. |
| A4 | **Play, guided** | 🔴 | No affordance says *try this*. The palette (`/`) is announced in 10px at the bottom. Layer isolation, torch focus and the dossier are all discoverable only by accident. |
| A5 | See the organigram | 🟡 | `/chart/` is live and branded — but linked **only** as a topbar item beside GitHub/npm. No section on the page shows it, explains it, or sells it. One of three faces, styled like a footer link. |
| A6 | **Understand the model** | 🔴 | **The site never teaches the contract.** No explanation of: what a layer/band is · what a bucket is · what a rule is and how inheritance works · what an agent's boot slice contains · what the JSON actually looks like. `SPEC.md` exists in the repo; the *converting surface* has none of it. |
| A7 | Try the ASK face | 🟡 | Two canned Q&As + a copyable URL. It's a screenshot in prose — there is **no way to ask anything from the page**. |
| A8 | Grasp "three faces" | 🔴 | SEE / GOVERN / ASK is internal framing. A visitor never learns there are three ways to use one brain. |
| A9 | Convert | 🟡 | `npx` command + GitHub. No "hosted / done-for-you" path, no email capture, nothing for a non-technical buyer. |

**A3, A4, A6, A8 are the same wound:** we built the machine and never wrote the
label. Everything is *shown*, nothing is *taught*.

---

## B · Surfaces

| Surface | State | Evidence / what's missing |
|---|---|---|
| Landing `/` | 🟡 | Live, on-brand, story coherent. Missing: model explainer, faces section, organigram section, in-page ask. |
| Viewer `/viewer/` | 🟡 | Layout, floors, landmarks, torch, entrance, dossier-by-verb, palette all ✅ verified on GPU. Missing: orientation/legend, guided first move, focus-camera dolly, d-pad walk, breadcrumb. |
| Staff board `/chart/` | 🟡 | Live, branded, ranked columns, dossier with personas + boot-order rules + contracts, read-only apply ✅. Missing: CRAFT §5 craft pass (engraved cards, rails, show-the-law overlay, ledger shelf, semantic zoom). |
| ASK `/mcp` | ✅ | Authless Streamable-HTTP, 8 tools incl. `booboo_count`, verified live from a real claude.ai connector: 3 majors this week, 98-vs-14 absences, boot slice correct. |
| Brand domain | ✅ | `booboo.fractionalhq.uk` — A record via Porkbun API, propagated, cert valid, all routes 200. |
| README | 🟡 | Leads with the zero-config command; badges; demo link. Not yet updated for `booboo_count` or the brand URL. |

---

## C · Product gaps found by using it

| # | Gap | State | Note |
|---|---|---|---|
| C1 | No aggregation | ✅ fixed | `booboo_count` — found by testing the live connector. |
| C2 | Panel counters read 0 | ✅ fixed | type `memory`→`observation` translation. |
| C3 | iframe canvas sizing race | ✅ fixed | Affected the shipped panel too. |
| C4 | Orbit swing emptied embeds | ✅ fixed | `orbit:0` for `?chrome=0`. |
| C5 | 3D labels bled through dossier | ✅ fixed | drei `zIndexRange` capped. |
| C6 | `panel-css.ts` had no generator | ✅ fixed | Claimed GENERATED, drifted silently. `scripts/sync-css.mjs`. |
| C7 | Weak-GPU/WebGL fallback | 🟡 | Guarded at the landing only. The **viewer package itself** still has none — a stranger deep-linking `/viewer/` on a weak device is unprotected. |
| C8 | No OG image | 🔴 | Every social share of the demo renders blank. Directly undercuts the distribution push. |
| C9 | Mobile | 🔴 | Landing degrades to a CSS starfield. `/viewer/` and `/chart/` on a phone: **unverified**, likely poor. |
| C10 | Golden-frame CI | 🔴 | One frame committed, no diffing. Design can regress silently. |
| C11 | Scale claim unproven | 🟡 | The million-node path has never been rendered end-to-end by me — only asserted. |

---

## D · Process

| # | Gap | State | Fix |
|---|---|---|---|
| D1 | No done-vs-intended map | ✅ fixed | This file. |
| D2 | Follow-ups scattered | 🟡 | Consolidated here; commit messages must now reference a row. |
| D3 | Stale secrets doc outranked canonical | 🔴 | `.secrets/porkbun_credentials.md` still says the key was "LOST AT CREATION". It wasn't — `.env.master` has both. A stale doc cost a wrong "blocked" call. Correct the doc; canonical is `.env.master`. |
| D4 | "Verified" used loosely | 🟡 | Rule: "verified" means an artefact was observed (screenshot, curl, live query) — not that code was written and built. |

---

## F · Build order

Ranked by *conversion impact per hour*, not by what's fun. Every item names
the row it closes.

**Tier 1 — the product currently fails its own acceptance test**

1. **Flags + health rendering** (A1) — the missing top of the luminance ladder.
   Data already exists: 4 flags, 10 health values. Without this the
   two-second test cannot be passed by anyone. *Nothing else matters more.*
2. **Verb colours + directional flow on edges** (A2) — 397 identical lines
   become readable relations; makes the trace legible later.
3. **Tokens actually consumed** (A0) — otherwise every fix above hardcodes
   more drift in.

**Tier 2 — the label for the machine**

4. **The model explainer** (B/A6) — teach bands, buckets, rule inheritance,
   boot slice, with real JSON shown.
5. **Orientation + guided play in the viewer** (B-A3/A4) — first-run legend
   naming the bands, "start here" pointing at the amber department.
6. **Promote the organigram** (B-A5/A8) — a real "three faces, one brain"
   section; the staff board shown, not a topbar link.
7. **In-page ask** (B-A7) + palette ask-mode (A4) — same engine, two surfaces.

**Tier 3 — proof and polish**

8. OG image (C8) · 9. mobile pass (C9) · 10. the 30-second trace (A3) ·
11. light-shaft spines (A2, signature) · 12. view presets (A4) ·
13. staff-board craft pass (A5) · 14. weak-GPU guard (C7) ·
15. golden CI (C10) · 16. million-node proof (C11).

Tier 1 is why this file exists: three items that were specified, assumed
done, and never built. Tier 2 is the same insight as before — **we built the
machine and never wrote the label.**
