#!/usr/bin/env node
// Capture a page in headless Chrome. Every previous capture in this project
// was an ad-hoc command line nobody could re-run; this one is committed.
//
//   node scripts/shot.mjs <url> <out.png|.jpg> [--w 1200] [--h 630]
//        [--vh 860] [--dpr 2] [--wait 6000] [--quality 88]
//        [--motion] [--touch] [--full] [--eval "js"]
//
// The driver lives in ./lib/cdp.mjs and is shared with check-golden.mjs —
// two copies of one mechanism is this project's most repeated defect
// (GAPS C29, C33, C2), so it gets imported, not pasted.
//
// The three flags that exist because a capture lied:
//
//   (default) reduced motion is ON, so GSAP and count-ups land instead of
//     being photographed mid-tween (GAPS C17 — a frozen counter read as a
//     data bug and cost a day).
//   --motion  turns it OFF, and there is exactly one reason to: web/main.js
//     serves the recorded loop instead of live WebGL under reduced motion,
//     so a default capture of `/` photographs the fallback, not the product.
//   --touch   makes the page match (pointer: coarse). A narrow MOUSE window
//     keeps every touch branch on its desktop path, so without this a
//     390px capture "proves" half of a mobile fix.
//
// --eval's return value is PRINTED. For colour, size and overflow, read
// computed style rather than pixels (GAPS C23, C32) — the probe is as much
// the point of this script as the image is.
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { launch } from "./lib/cdp.mjs";

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf("--" + n); return i === -1 ? d : args[i + 1]; };
const has = (n) => args.includes("--" + n);
const [url, out] = args.filter((a, i) => !a.startsWith("--") && !(args[i - 1] || "").startsWith("--"));

if (!url || !out) {
  console.error("usage: shot.mjs <url> <out.png|.jpg> [--w][--h][--vh][--dpr][--wait][--quality][--motion][--touch][--full][--eval js]");
  process.exit(2);
}

const W = +flag("w", 1200);
const H = +flag("h", 630);
// Viewport height, when it must differ from the output height. The landing's
// hero is min-height:100svh and its vignette hands off to cream at exactly
// 100%, so rendering into a 630-tall viewport puts that seam a fifth of the
// way up the frame. Render tall, clip the top.
const VH = +flag("vh", H);

const b = await launch({ width: W, height: VH, dpr: +flag("dpr", 1), motion: has("motion"), touch: has("touch") });
try {
  await b.goto(url, +flag("wait", 6000));

  const js = flag("eval");
  if (js) {
    const v = await b.eval(js);
    if (v !== undefined) console.log(JSON.stringify(v, null, 2));
    await new Promise((r) => setTimeout(r, 800));
  }

  // A .jpg out-path asks for JPEG. Worth it for OG cards: a 2x PNG of the
  // cosmos is 1.4MB and several link unfurlers quietly skip anything that
  // heavy, which looks identical to having no og:image at all.
  const jpeg = /\.jpe?g$/i.test(out);
  const png = await b.shot({
    format: jpeg ? "jpeg" : "png",
    ...(jpeg ? { quality: +flag("quality", 88) } : {}),
    ...(has("full") ? {} : { clip: { x: 0, y: 0, width: W, height: H } }),
  });

  mkdirSync(dirname(resolve(out)), { recursive: true });
  writeFileSync(resolve(out), png);
  console.log(`${out}  ${W}x${H}`);
} finally {
  b.close();
}
