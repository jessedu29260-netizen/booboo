# CRAFT — the visual & technical design law for Booboo's surfaces

> Status: DESIGN (ratified in-session 2026-07-18). Governs the cosmos viewer,
> the organigram panel, the demo site, and the hosted ASK face. Companion to
> `examples/pemberton/DESIGN.md` (the dataset). Rule zero: **nothing ships
> random** — if a value isn't a token or a written decision here, it doesn't
> ship.

## The thesis

A dev graph renders data. A converting surface renders *a place with a
problem in it*. The distance between the two is not effects — it is
assignment: every brightness, easing, size and colour is given a job. The
acceptance test stays the Pemberton two-second test: a stranger can say what
the organisation is, how it's structured, and where the problem is.

## 0 · Tokens (single source, three consumers)

`design/tokens.json` → generated CSS vars + TS module → consumed by site,
viewer, panel. No raw values in components.

- **Colour** in OKLCH. Base palette from the shipped viewer tokens (bg
  #06080e · text #E8DCC4 · gold #c9a04a · goldHi #E8C877 · dim #8a8268 ·
  line #1c2130) — re-specified in OKLCH and extended with band hues at
  perceptually equal lightness steps. Verb colours for edges are tokens.
- **Type**: Fraunces (display, opsz axis used deliberately) · DM Sans (UI) ·
  JetBrains Mono (data readouts). Scale: 11/12.5/14/16/19/24/32/display.
  Smallcaps labels always tracked +0.15–0.19em.
- **Spacing** on a 4px grid. Radii: 2/3/6. One shadow set. One z-layer map.
- **Easing set**: `swift` cubic-bezier(.2,.7,.25,1) · `settle`
  cubic-bezier(.16,1,.3,1) · `pulse` sine. Durations: 120/300/800/3500ms.
  Nothing linear, ever.

## 1 · The luminance hierarchy (the anti-dev-graph law)

Assigned once, enforced everywhere, top = brightest:

```
flags  >  badges/contracts  >  pulses/flow  >  landmark nodes
       >  field nodes  >  structural edges  >  field edges
       >  disc etchings  >  discs  >  atmosphere  >  background
```

- Bloom is **selective**: luminanceThreshold tuned so only flag/pulse
  emissives bloom. Global bloom default = 0 (the cosmos lesson).
- Flags must be findable at default zoom with peripheral vision. If a
  screenshot's brightest pixel is not a flag or a badge, the frame fails QA.

## 2 · Scene design (SEE face)

**From particles to a place.** The scene is a night observatory owned by a
grand hotel: brass instruments over glass floors under a faint nebula.

- **Landmarks are objects.** GM + department heads + contract glyphs =
  instanced meshes, PBR brass/gilt (metalness high, roughness mapped, env
  from a subtle nebula IBL), soft contact shadow blobs onto their disc.
  The dense field stays points — custom sprite shader: circular SDF, soft
  core + thin rim, per-tier size curve, depth fade. No square points.
- **The observatory floor.** Each band disc: radial-gradient glass, etched
  concentric rules, the band name ENGRAVED into the disc surface (curved
  text on the floor, clock-face style) + a small rim label for edge-on
  reading. Rim light on the disc edge. Bands breathe ±0.3% scale.
- **Light-shaft spines.** Parent→child authority renders as cone beams
  falling from above: cylinder impostors, fresnel falloff, gradient alpha,
  animated grain drifting downward. Authority = light falling. This is the
  signature element; protect it.
- **Edges.** Structural/semantic (tier ≤1 endpoints): quad-ribbon fat lines,
  source→target colour gradient, directional flow dashes (speed ∝ recency/
  throughput where data exists, else slow default). Verb → token colour.
  Field edges: thin GL lines, faint, NormalBlending. The cosmos tier-culling
  law stands: both-endpoints-deep edges are data, not pixels.
- **Atmosphere.** Exponential height fog; 2-layer parallax starfield; faint
  nebula sprite field (off by default on low tier). Background is a graded
  nadir-dark dome, never flat black.
- **Focus = torch.** On select: DoF (bokeh) racks to the node, its edges
  light to full verb colour, non-neighbourhood dims to 40%, dossier opens.
  Deselect restores over 300ms `settle`.
- **Camera.** Entrance frames the whole structure. Dolly-to-node on select
  (800ms `swift`). Orbit constrained above the floor plane. Auto-reframe on
  band toggle. d-pad steps animate between siblings.

## 3 · Motion choreography

- **Entrance (once, skippable, prefers-reduced-motion → static final frame):**
  0.0s bands rise bottom-up staggered · 1.2s spines ignite top-down (the
  law flows down) · 2.2s field fades in · 2.8s flags ignite LAST · 3.5s
  settle. The eye must land on the problem.
- **The trace (Act 2, triggered):** the six Pemberton beats with camera
  moves per beat. Ships after static data proves out.
- **Micro:** hover 120ms scale 1.06 + label fade; select ring ripple; all
  from the easing set.

## 4 · Chrome (2D layer, shared components)

- **Demo mode: four view presets** — OVERVIEW · DEPARTMENTS · LEDGER ·
  TRACE. Pro controls (sliders) live behind a drawer; a converting surface
  shows four buttons, not fourteen sliders.
- **The dossier** is ONE shared component (viewer + panel + site): metric
  cards · verb-grouped relations with counts (owns 34 · inherits 2 …) ·
  health bar · persona · rules in boot order · flight recorder. Port the
  Dionisos OS dossier design language; Pemberton skin via tokens.
- **The concierge palette** — the signature interaction. `/` opens one
  input. Node-ish query → ranked jump results. Question → routes to the
  hosted MCP ASK endpoint, streams the answer as a transcript. Find-or-ask,
  one box. Canned chips seed the baked questions.
- **Legend** top-left: band chips with live counts, monospace.
- **States:** loading = constellation skeleton sketch; error = brand-voiced
  ("The house is momentarily dark."); empty = never blank, always a hint.

## 5 · The organigram (GOVERN face) — redesigned from craft

Metaphor: **the staff board** of a grand house — engraved cards on brass
rails.

- True tree, orthogonal elbow rails. Rank rows = the three people-bands.
  **Department column order = cosmos sector order** (the one-ordering law:
  sectors in SEE, columns in GOVERN, chips in legends — identical order
  everywhere).
- Cards: role smallcaps · persona line · health chip · bucket chips · rule
  count · last report. Hover = quick stats; click = the shared dossier.
- **"Show the law" toggle**: overlays rule inheritance as a second rail
  system (House Standard → SOPs → roles), gold on dim. Authority made
  visible on demand without cluttering the default.
- **The ledger shelf**: buckets as a bottom shelf; hovering any card lights
  its reach lines. Sealed bucket renders locked.
- Drag-reorg keeps ghost preview + cycle validation (shipped); snap animates
  `settle`; the org-file diff is shown before apply.
- Semantic zoom: house → department → role.

## 6 · The Pemberton micro-brand

Crest (monogram P, laurel, pure SVG — resembles no real mark), "THE
PEMBERTON GRAND · EST. 1927", brass-and-midnight skin applied via tokens
over the Booboo base. The point is conversion: a visitor sees a *branded
client deliverable* and imagines their own crest in its place — the
done-for-you tier sold without copy. Skinning therefore ships as a real
mechanism (token override file per brand), demo as its proof.

## 7 · The site (scrollytelling)

The demo IS the page. Scroll chapters drive camera presets:
structure → flags → trace → crossfade to the staff board → the palette
types a question and streams the real answer → CTA. CTAs at comprehension
peaks (post-trace: "Run this on your company" npx · post-ask: "Point Claude
at your stack" config · close: GitHub / Drop / done-for-you).

- Performance: hero text paints first; canvas defers; LCP < 2.5s; DPR cap
  [1, 2]; postprocessing half-res where quality allows; 60fps at the 2.4k
  default on integrated GPU is the budget.
- **Mobile: no live WebGL.** A rendered video loop of the same scenes,
  chapter-scrubbed. Phones get cinema, not gambles.
- OG image = the entrance's money frame (closes the missing-OG hole).
- Analytics events: preset change · trace complete · palette open · ask
  submitted · config copied. Conversion is measured through the story.

## 8 · ASK, hosted (the plumbing)

- Streamable HTTP transport in `@booboo-brain/serve` (`--mcp-http`), spec
  support in the MCP SDK **TBV before authoring**. Read-only enforced
  (`BOOBOO_READONLY=1`), rate-limited, CORS-scoped to the demo origin.
- Deploy: Railway (long-running node; ~$5/mo — Jesse spend gate).
- Site ask-UI streams via the palette. Embedded server-side LLM concierge
  (our key, public page) is a SEPARATE spend decision — abuse surface +
  per-token cost; v1 ships endpoint + visitor's-own-client config +
  streamed canned chips.

## 9 · Governance

- Golden frames: 5 committed reference screenshots (entrance final frame,
  focus state, trace beat 3, staff board, palette answer). CI pixel-diffs
  against them.
- Per-PR design QA: luminance order respected · all easings from the set ·
  no default three.js materials · no unstyled states · one-ordering law
  holds · tokens only.

## Build slices

1. tokens + cosmos re-render (layout.ts axis decoupling lands here first —
   structure before beauty)
2. organigram staff board
3. shared dossier + concierge palette
4. HTTP transport + Railway deploy
5. Pemberton dataset (per examples/pemberton/DESIGN.md)
6. scrollytelling site + copy rewrite ("a company truly run by AI")

Slice 1 is the gate: nothing else reads until clusters stop interleaving
and the luminance law is enforced.
