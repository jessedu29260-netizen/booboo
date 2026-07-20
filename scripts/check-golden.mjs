#!/usr/bin/env node
/* Golden frames — GAPS C10, built on the shape of check-vendored-index.mjs:
 * probe, compare, fail loudly, and prove the guard by breaking it on purpose.
 *
 *   node scripts/check-golden.mjs            compare against design/golden/frames.json
 *   node scripts/check-golden.mjs --update   re-record it (review the diff!)
 *
 * ── Why this compares MEASUREMENTS and not PIXELS ──────────────────────────
 *
 * "Golden frame" says image, and an image diff is the obvious build. It does
 * not survive contact with this project:
 *
 *   1. CI is ubuntu, development is Windows. Font rasterisation differs, so
 *      every text pixel differs. A tolerance loose enough to absorb that is
 *      loose enough to miss a layout regression.
 *   2. The cosmos is WebGL. CI has no GPU and falls back to a software
 *      rasteriser; local runs on ANGLE. Different renderer, different pixels,
 *      legitimately.
 *   3. The page loads webfonts from Google. A slow font in CI is a different
 *      frame, and a check that fails on someone else's CDN is a check people
 *      learn to re-run until it passes.
 *
 * A check that cries wolf is worse than no check: it trains everyone to ignore
 * CI. That is the same argument release.yml already makes about not reddening
 * main over a missing credential.
 *
 * So a "frame" here is the set of facts a screenshot was ever going to be read
 * FOR. Look at what actually regressed in this codebase and none of it needed
 * pixels — every one is a computed value or a count:
 *
 *   C16  a palette that resolved to nothing        → computed colour
 *   C23  the light pivot silently broke dark       → computed colour, per theme
 *   C27  a rule that lightened nothing on light    → computed colour
 *   C32  a host's tokens shadowing the panel's     → computed colour
 *   C34  the cascade degenerating into a queue     → measured height, lane count
 *   C18  fit-to-width collapsing to 52%            → measured scale
 *   C9   the camera ending up inside the building  → camera distance
 *
 * Measurements also diff READABLY in a pull request: "board height 6540 →
 * 12211" tells you what broke. A changed PNG tells you something changed.
 *
 * The rendered PNG is still written to design/golden/ on --update, because a
 * human should be able to look. It is a reference, not the gate.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { spawn } from "node:child_process";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { launch, serveDir } from "./lib/cdp.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const GOLDEN = join(ROOT, "design", "golden", "frames.json");
const UPDATE = process.argv.includes("--update");

const DIST = join(ROOT, "web", "dist");
if (!existsSync(join(DIST, "index.html")))
  throw new Error("web/dist is not built — run `node scripts/build-web.mjs` first");

/* Each probe returns a plain object of stable facts. Anything font-metric
 * dependent is deliberately excluded: text WIDTH is not a fact, it is a
 * rasteriser's opinion. Colours, counts, ratios and booleans are facts. */

const LANDING = `(() => {
  const cs = (sel, prop) => { const e = document.querySelector(sel); return e ? getComputedStyle(e)[prop] : null; };
  const de = document.documentElement;
  return {
    // C16: tokens must RESOLVE. A var() that resolves to nothing renders as
    // transparent/initial and looks like a design choice.
    tokenBg:   getComputedStyle(de).getPropertyValue("--bg").trim(),
    tokenGold: getComputedStyle(de).getPropertyValue("--gold").trim(),
    heroBg:    cs(".hero", "backgroundColor"),
    heroColor: cs(".hero", "color"),
    // the OG card is the whole of C8 and is one attribute away from vanishing
    ogImage:   !!document.querySelector('meta[property="og:image"]')?.content,
    ogAlt:     !!document.querySelector('meta[property="og:image:alt"]')?.content,
    // structure
    sections:  document.querySelectorAll("section, header.hero").length,
    // C9: no horizontal overflow the visitor can reach
    canScrollX: (() => { de.scrollLeft = 300; const v = de.scrollLeft; de.scrollLeft = 0; return v; })(),
  };
})()`;

const LANDING_NARROW = `(() => {
  const de = document.documentElement;
  const v = document.querySelector(".stage video");
  return {
    // C9 + C7: a narrow / low-tier visitor gets the recorded house, and the
    // claim under it matches what is actually on screen. Both have been wrong.
    hasVideo:   !!v,
    videoSrc:   v ? v.getAttribute("src") : null,
    videoLoops: v ? v.loop && v.muted && v.hasAttribute("playsinline") : null,
    claimsLive: /\\blive\\.?$/.test(document.getElementById("hero-claim")?.textContent?.trim() ?? ""),
    canScrollX: (() => { de.scrollLeft = 300; const x = de.scrollLeft; de.scrollLeft = 0; return x; })(),
  };
})()`;

const BOARD = `(() => {
  const q = (s) => document.querySelector(s);
  const n = (s) => document.querySelectorAll(s).length;
  const chart = q(".chart");
  const pct = document.querySelector(".zoomer-pct")?.textContent ?? null;
  return {
    // C34: a wide-flat org must not stack into a single-file queue. These are
    // the numbers A5 recorded when the cascade shipped — 9 lanes, 62 cards,
    // 61 rails — so a drift in any of them is a real structural change.
    //
    // The selectors are asserted at record time rather than trusted. The first
    // draft of this probe asked for .lane and .casc-rail, neither of which
    // exists, and recorded lanes 0 / rails 10 as GOLDEN - a guard that would
    // then agree with itself forever while measuring nothing. GAPS C23 (a rule
    // that matches nothing looks exactly like one that works), reproduced
    // inside the check meant to catch it.
    rows:      n(".oc-row"),      // 9 departments + the root row
    cards:     n(".ag"),          // A5 recorded 62
    rails:     n("path.rail-line"),  // A5 recorded 61
    machineRacks: n(".oc-tray"),  // 8 — one department declares no machines
    packExists: !!q(".solo-pack"),
    boardHeight: chart ? Math.round(chart.scrollHeight) : null,
    // C18: fit-to-width must not crush the plates to unreadability
    zoom: pct,
    // C23 + C32: the theme must actually resolve, on the panel's own root
    theme: q(".pnl")?.getAttribute("data-theme") ?? null,
    cardBg: q(".ag") ? getComputedStyle(q(".ag")).backgroundColor : null,
    ink: q(".pnl") ? getComputedStyle(q(".pnl")).getPropertyValue("--ink").trim() : null,
  };
})()`;

// The landing is static, so web/dist is enough. The BOARD is not: it fetches
// /api/org and /api/booboo/*, which on the demo are serverless functions. Boot
// the real `booboo panel` for it instead — the same thing an OSS user runs, and
// the same thing ci.yml already smoke-tests. Checking the board against a mock
// would be C33's mistake exactly: verifying a path no user takes.
const PANEL_PORT = 8991;
const panel = spawn(process.execPath, [
  join(ROOT, "packages", "cli", "dist", "cli.js"), "panel",
  "--org", join(ROOT, "examples", "pemberton", "org.pemberton.booboo.json"),
  "--snapshot", join(ROOT, "examples", "pemberton", "pemberton.booboo.json"),
  "--port", String(PANEL_PORT), "--no-open",
], { stdio: ["ignore", "ignore", "pipe"] });
const PANEL = "http://127.0.0.1:" + PANEL_PORT;
for (let i = 0; i < 60; i++) {
  try { if ((await fetch(PANEL + "/api/org")).ok) break; } catch {}
  await new Promise((r) => setTimeout(r, 500));
  if (i === 59) throw new Error("booboo panel never came up on " + PANEL);
}

const SURFACES = [
  { name: "landing/1440x900", base: "dist", path: "/", w: 1440, h: 900, motion: true, wait: 9000, probe: LANDING },
  { name: "landing/390x844", base: "dist", path: "/", w: 390, h: 844, touch: true, motion: true, wait: 9000, probe: LANDING_NARROW },
  { name: "board/1600x1000", base: "panel", path: "/", w: 1600, h: 1000, wait: 12000, probe: BOARD },
  { name: "board/390x844", base: "panel", path: "/", w: 390, h: 844, touch: true, wait: 12000, probe: BOARD },
];

const server = await serveDir(DIST);
const got = {};
try {
  for (const s of SURFACES) {
    const b = await launch({ width: s.w, height: s.h, motion: !!s.motion, touch: !!s.touch });
    try {
      await b.goto((s.base === "panel" ? PANEL : server.url) + s.path, s.wait);
      got[s.name] = await b.eval(s.probe);

      // A probe that measures NOTHING is the failure mode this whole file
      // exists to prevent, and it is silent by construction: a mistyped
      // selector returns 0 or null, gets recorded as golden, and then agrees
      // with itself forever. So every count must be positive and every colour
      // must resolve — checked at RECORD time, where a human is looking.
      // --update only: on a COMPARE run a null is a real drift and belongs in
      // the diff report, where it reads as "videoSrc: golden=... got=null".
      // Throwing there would replace a legible design diff with a stack trace.
      const dead = !UPDATE ? [] : Object.entries(got[s.name]).filter(([k, v]) =>
        (typeof v === "number" && v === 0 && k !== "canScrollX") ||
        v === null || v === "" || v === "rgba(0, 0, 0, 0)");
      if (dead.length)
        throw new Error(
          `${s.name}: ${dead.length} probe(s) measured nothing — ` +
          dead.map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(", ") +
          `\n  A zero is almost always a selector that matches nothing, not a real zero.` +
          `\n  Fix the probe; do NOT record this as golden.`);
      if (UPDATE) {
        const png = await b.shot({ clip: { x: 0, y: 0, width: s.w, height: s.h } });
        const dir = join(ROOT, "design", "golden");
        mkdirSync(dir, { recursive: true });
        writeFileSync(join(dir, s.name.replace(/[/]/g, "-") + ".png"), png);
      }
    } finally { b.close(); }
  }
} finally { server.close(); panel.kill(); }

if (UPDATE) {
  mkdirSync(dirname(GOLDEN), { recursive: true });
  writeFileSync(GOLDEN, JSON.stringify(got, null, 2) + "\n");
  console.log("recorded " + Object.keys(got).length + " frames → design/golden/frames.json");
  console.log("READ THE DIFF before committing — this file is the definition of correct.");
  process.exit(0);
}

if (!existsSync(GOLDEN)) {
  console.error("no design/golden/frames.json — run: node scripts/check-golden.mjs --update");
  process.exit(1);
}
const want = JSON.parse(readFileSync(GOLDEN, "utf8"));

const drift = [];
for (const name of Object.keys(want)) {
  if (!(name in got)) { drift.push(`  ${name}: surface missing from this run`); continue; }
  for (const [k, v] of Object.entries(want[name])) {
    const a = JSON.stringify(v), b = JSON.stringify(got[name][k]);
    if (a !== b) drift.push(`  ${name} · ${k}: golden=${a} got=${b}`);
  }
}
for (const name of Object.keys(got)) if (!(name in want)) drift.push(`  ${name}: new surface, not in golden`);

if (drift.length) {
  console.error("the rendered surfaces drifted from design/golden/frames.json:\n" + drift.join("\n"));
  console.error("\nIf the change is INTENDED: node scripts/check-golden.mjs --update, then commit");
  console.error("frames.json in the same commit as the work — the diff is the design review.");
  process.exit(1);
}
const nProbes = Object.values(want).reduce((a, o) => a + Object.keys(o).length, 0);
console.log(`✓ ${Object.keys(want).length} surfaces agree with the golden frames on ${nProbes} probes`);
