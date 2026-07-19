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

## A · The visitor journey (the conversion path)

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

## E · What to build next, in order

Ranked by *conversion impact per hour*, not by what's fun:

1. **The model explainer** (A6) — a site section that teaches bands, buckets, rules-inheritance and the boot slice, with the real JSON shown. Without this the product is a pretty object.
2. **Orientation + guided play in the viewer** (A3/A4) — a first-run legend naming the four bands, a "start here" pointing at a department, and the palette surfaced properly.
3. **Promote the organigram** (A5/A8) — a real section: three faces, one brain, with the staff board shown, not a topbar link.
4. **In-page ask** (A7) — a question box that calls `/mcp` live. The strongest proof we own and it's currently prose.
5. **OG image** (C8) — cheap, and every share is currently blank.
6. **Mobile pass** (C9) — verify, then decide video-vs-degrade.
7. Staff board craft pass (CRAFT §5), viewer weak-GPU guard (C7), golden CI (C10), million-node proof (C11).

Items 1–4 are all the same insight: **we built the machine and never wrote the
label.**
