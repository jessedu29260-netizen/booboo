# HANDOFF — the Booboo demo craft pass

> Written 2026-07-19 by the session that built everything below. Read this,
> then `design/GAPS.md` (the only doc allowed to claim "done"), then
> `design/CRAFT.md` (the visual law) and `examples/pemberton/DESIGN.md`
> (the dataset). This file is the bridge; those three are the spec.

## Where it stands

**Live and working:** https://booboo.fractionalhq.uk

| Surface | What it does |
|---|---|
| `/` | Landing: hero with the live brain behind it, an embedded playable graph, three-faces section, the model taught as five nouns, a working in-page ask, quickstart |
| `/viewer/` | The cosmos — 2,414-node Pemberton, flags, verb-coloured relations, torch focus, entrance choreography, orientation card, `/` palette, verb-grouped dossier |
| `/chart/` | The staff board — nine department lanes, 15 real vendor marks, personas, boot-order rules, read-only |
| `/mcp` | Authless Streamable-HTTP MCP, 8 tools incl. `booboo_count`. Free, on the same Vercel project |

Branch `feat/public-demo-site`, ~33 commits, PR #5 open and unmerged.

## The verdict you are here to fix

Jesse's words, and they're right: *"you are making huge progress but overall
not above other, it doesn't get its place out of the mould."*

The diagnosis: **it is a very competent dark-SaaS aesthetic with a brass
accent** — the same neighbourhood as Linear, Vercel, Resend. Good taste,
zero risk, no point of view. Nothing about it could only be Booboo.

**The thesis I'd hand you, to take or discard:** stop designing a developer
tool that happens to be about a hotel, and design *the hotel's own
instrument*. The Pemberton is a grand house — the design language available
is brass plaques, engraved room numbers, the key-rack behind reception,
leather-bound ledgers, Art Deco signage, the bell desk. A staff board could
literally be **a staff board**: a brass pigeonhole rack with engraved name
plates and key hooks. Nobody in this category is doing hospitality
materiality, and it is native to the story rather than pasted on.

Take that direction or beat it — but pick a point of view and commit. The
current design's failure is that it has none.

## The specific work

1. **Staff-card faces** (`/chart/`). Today a card reads "Lift Engineer" with
   "Lift Engineer — Engineering" beneath it — the same words twice. Kill the
   redundancy; put what matters on the face: health, bucket reach, rule
   count, last report. CRAFT §5 calls for engraved cards on orthogonal brass
   rails and the elbow connectors are currently hidden inside lanes.
2. **"Show the law" overlay** (`/chart/`) — a toggle that draws rule
   inheritance as a second rail system, House Standard → SOPs → roles. This
   is the product's core idea and it is invisible.
3. **Ledger shelf** — hover a role, its reachable buckets light. Also unbuilt.
4. **Semantic zoom** — house → department → role.
5. **Light-shaft spines** (`/viewer/`) — CRAFT §2's signature element,
   cone-beams falling from a parent to its children, *authority as light
   falling*. Specified, protected in writing, never built.
6. **Four view presets** instead of the fourteen-slider drawer (CRAFT §4).

## Landmines — each one cost me real time

- **Background-tab animation freeze.** A `CSSTransition` sits at
  `currentTime: 0` forever in an unfocused tab, so `getComputedStyle`
  returns the *from* value. This made a working `scale(0.808)` read as
  `scale(1)` and sent me chasing a CSS bug that did not exist. It also makes
  headless screenshots catch mid-reveal states. **Finish or cancel
  animations before trusting any computed-style read**, and pin animations
  off when capturing.
- **The panel's CSS is generated.** `packages/panel/src/panel-css.ts` is
  built from `packages/panel/app/panel.css` by
  `node packages/panel/scripts/sync-css.mjs`. Editing the CSS without
  syncing ships nothing — it silently did exactly that to me once. (The file
  claimed "GENERATED" for months with no generator; I wrote one.)
- **Tokens are generated.** `design/tokens.json` →
  `scripts/gen-tokens.mjs` → `packages/viewer/src/tokens.ts` +
  `web/tokens.css` + `packages/panel/app/tokens.css`. It runs inside
  `scripts/build-web.mjs`. Never hand-edit the outputs; never hardcode a
  colour.
- **Simple Icons removes brands on trademark request.** Mews, Twilio,
  OpenTable and Slack all 404. Curl
  `https://cdn.simpleicons.org/<slug>` before using any new vendor mark.
- **`web/dist` gets locked** if you leave a static server running on it; the
  build then fails `EBUSY`. Kill temp servers by port when done.
- **Two WebGL contexts** now live on the landing page (hero + embedded
  viewer). It choked the in-app browser pane. Unmeasured on real hardware —
  worth profiling before adding a third.

## Build, verify, ship

```bash
cd C:/Users/jesse/Desktop/Projects/booboo

# viewer change
pnpm -F @booboo-brain/viewer build

# panel change  (sync FIRST or the CSS does not ship)
node packages/panel/scripts/sync-css.mjs
pnpm -F @booboo-brain/panel build

# assemble + deploy (gen-tokens runs inside build-web)
node scripts/build-web.mjs
npx vercel@latest deploy web/dist --prod --yes --name booboo

# regenerate the dataset after editing generate.mjs
cd examples/pemberton && node generate.mjs
```

**Verification that counts:** headless Chrome with the real GPU, because
software rendering flattens the scene and lies about it.

```bash
"/c/Program Files/Google/Chrome/Application/chrome.exe" \
  --headless=new --use-angle=d3d11 --enable-gpu --ignore-gpu-blocklist \
  --hide-scrollbars --window-size=1440,900 --virtual-time-budget=24000 \
  --screenshot=out.png "https://booboo.fractionalhq.uk/chart/"
```

Freeze the scene for stills with
`?cfg=%7B%22orbit%22%3A0%2C%22drift%22%3A0%7D`; embed-mode is
`?chrome=lite`; background-mode is `?chrome=0`.

## The rule that governs this work

`design/GAPS.md` is the only document allowed to say "done", every ✅ carries
the evidence that proved it, and it updates **in the same commit as the
work**. That rule exists because this project accumulated a whole invisible
slice — flags, verb colours, tokens all specified, assumed shipped, never
built — while every individual step looked verified. Do not let that happen
again.

And Jesse's standard, verbatim: *"don't deliver just to mark it done, every
step must be stopped by — is it making it truly above others? If not,
iterate and keep going."*

## Do not touch without asking

PR #5 merge · the brand domain DNS · npm publishes · anything that spends
money. The Porkbun keys live in `.env.master` (the `.secrets/*.md` mirror is
stale and wrongly claims the secret was lost).
