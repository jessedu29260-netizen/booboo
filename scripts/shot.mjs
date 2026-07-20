#!/usr/bin/env node
// Capture a page in headless Chrome over CDP. No dependencies — Node 24 ships
// WebSocket, and every previous capture in this project was an ad-hoc command
// line that nobody could re-run.
//
//   node scripts/shot.mjs <url> <out.png> [--w 1200] [--h 630] [--wait 6000]
//                                         [--full] [--motion] [--eval "js"]
//
// Two things are non-negotiable and are why this file exists rather than a
// bare `chrome --screenshot`:
//   * --force-prefers-reduced-motion, so GSAP/count-up land instantly instead
//     of being photographed mid-tween (GAPS C17).
//   * a real wait on the page's own clock, not --virtual-time-budget, which
//     fast-forwards rAF and leaves WebGL scenes un-rendered.
//
// `--motion` opts OUT of reduced motion, and there is one real reason to:
// the landing's own guard (web/main.js) serves the static starfield instead of
// the cosmos when the preference is set, so a reduced-motion capture of `/`
// photographs the fallback and not the product. Use it only when the thing
// being captured is gated on motion, and give it a long --wait.
import { spawn } from "node:child_process";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { tmpdir } from "node:os";

const CHROME =
  process.env.CHROME_PATH ||
  "C:/Program Files/Google/Chrome/Application/chrome.exe";

const args = process.argv.slice(2);
const flag = (n, d) => {
  const i = args.indexOf("--" + n);
  return i === -1 ? d : args[i + 1];
};
const has = (n) => args.includes("--" + n);
const [url, out] = args.filter((a, i) => !a.startsWith("--") && !(args[i - 1] || "").startsWith("--"));

if (!url || !out) {
  console.error("usage: shot.mjs <url> <out.png> [--w 1200] [--h 630] [--wait 6000] [--full] [--eval js]");
  process.exit(2);
}

const W = +flag("w", 1200);
const H = +flag("h", 630);
const WAIT = +flag("wait", 6000);
const DPR = +flag("dpr", 1);
// Viewport height, when it must differ from the output height. The landing's
// hero is `min-height:100svh` and its vignette hands off to the cream section
// at exactly 100% — so rendering it in a 630px-tall viewport puts that seam a
// fifth of the way up the frame. Render tall, clip the top.
const VH = +flag("vh", H);

const profile = resolve(tmpdir(), "booboo-shot-" + process.pid);
const chrome = spawn(CHROME, [
  "--headless=new",
  "--remote-debugging-port=0",
  "--user-data-dir=" + profile,
  "--hide-scrollbars",
  ...(has("motion") ? [] : ["--force-prefers-reduced-motion"]),
  "--enable-gpu",
  "--use-gl=angle",
  "--use-angle=gl-egl",
  "--window-size=" + W + "," + VH,
  "about:blank",
], { stdio: ["ignore", "ignore", "pipe"] });

const wsUrl = await new Promise((ok, no) => {
  let buf = "";
  const t = setTimeout(() => no(new Error("chrome did not report a debug port")), 20000);
  chrome.stderr.on("data", (d) => {
    buf += d;
    const m = buf.match(/ws:\/\/[^\s]+/);
    if (m) { clearTimeout(t); ok(m[0]); }
  });
});

const ws = new WebSocket(wsUrl);
await new Promise((ok) => ws.addEventListener("open", ok, { once: true }));

let id = 0;
const pending = new Map();
ws.addEventListener("message", (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
});
const send = (method, params = {}, sessionId) =>
  new Promise((ok, no) => {
    const i = ++id;
    pending.set(i, (m) => (m.error ? no(new Error(method + ": " + m.error.message)) : ok(m.result)));
    ws.send(JSON.stringify({ id: i, method, params, sessionId }));
  });

const { targetId } = await send("Target.createTarget", { url: "about:blank" });
const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
const S = (m, p) => send(m, p, sessionId);

await S("Page.enable");
// `--touch` makes the page match `(pointer: coarse)`. Without it a 390px-wide
// headless window is still a mouse, so every touch-conditional branch stays on
// its desktop path and a capture "proving" the phone layout proves half of it.
await S("Emulation.setDeviceMetricsOverride", { width: W, height: VH, deviceScaleFactor: DPR, mobile: has("touch") });
if (has("touch")) {
  await S("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
  await S("Emulation.setEmitTouchEventsForMouse", { enabled: true, configuration: "mobile" });
}
await S("Page.navigate", { url });
await new Promise((r) => setTimeout(r, WAIT));

// A hidden tab suspends rAF and serves stale compositor frames, so a capture
// from one is not evidence (NEXT_SESSION). Headless is always visible, but
// assert it rather than assume it.
const vis = await S("Runtime.evaluate", { expression: "document.visibilityState", returnByValue: true });
if (vis.result.value !== "visible") throw new Error("page is " + vis.result.value + " — capture is not evidence");

const js = flag("eval");
if (js) await S("Runtime.evaluate", { expression: js, awaitPromise: true });
if (js) await new Promise((r) => setTimeout(r, 800));

// A .jpg out-path asks Chrome for JPEG. Worth it for OG images: a 2x PNG of
// the cosmos is ~1.4MB and several link unfurlers quietly skip anything that
// heavy, which looks identical to having no og:image at all.
const jpeg = /\.jpe?g$/i.test(out);
const shot = await S("Page.captureScreenshot", {
  format: jpeg ? "jpeg" : "png",
  ...(jpeg ? { quality: +flag("quality", 88) } : {}),
  captureBeyondViewport: has("full"),
  // clip is in CSS pixels and deviceScaleFactor already supplies the density,
  // so scale stays 1 — setting it to DPR too multiplies the two.
  ...(has("full") ? {} : { clip: { x: 0, y: 0, width: W, height: H, scale: 1 } }),
});

mkdirSync(dirname(resolve(out)), { recursive: true });
writeFileSync(resolve(out), Buffer.from(shot.data, "base64"));
console.log(`${out}  ${W}x${H}`);

ws.close();
chrome.kill();
try { rmSync(profile, { recursive: true, force: true }); } catch {}
