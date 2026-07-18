/* Booboo landing — device gating, copy buttons, readout.
   The viewer has no WebGL detection and no weak-GPU fallback (SCALE.md lists
   both as roadmap), so the guards live here. A public demo must never hand a
   visitor a black rectangle or crash their phone. */

(function () {
  "use strict";

  var stage  = document.getElementById("stage");
  var frame  = document.getElementById("brain");
  var rNodes = document.getElementById("rNodes");
  var rRender= document.getElementById("rRender");
  var openFull = document.getElementById("openFull");

  var reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  function hasWebGL() {
    try {
      var c = document.createElement("canvas");
      return !!(window.WebGLRenderingContext &&
        (c.getContext("webgl2") || c.getContext("webgl")));
    } catch (e) { return false; }
  }

  // Rough capability tier. navigator.deviceMemory / hardwareConcurrency are
  // absent on Safari, so unknown is treated as capable and the width check
  // carries the decision.
  function tier() {
    var w = window.innerWidth;
    var cores = navigator.hardwareConcurrency || 8;
    var mem = navigator.deviceMemory || 8;
    var coarse = matchMedia("(pointer: coarse)").matches;
    if (w >= 1024 && !coarse && cores >= 6 && mem >= 4) return "high";
    if (w >= 768 && cores >= 4) return "mid";
    return "low";
  }

  // Hero is a background — it stays light so first paint is fast.
  // The CTA is the flex, and it scales too: a million nodes on a phone is a
  // crashed tab, which is a worse outcome than a smaller honest number.
  var HERO = { high: 60000, mid: 24000, low: 8000 };
  var FULL = { high: 1000000, mid: 250000, low: 60000 };

  var fmt = function (n) { return n.toLocaleString("en-GB"); };

  var t = tier();
  var gl = hasWebGL();

  // Reduced motion: the scene auto-orbits and drifts and does not respect the
  // preference internally, so we serve the static starfield instead.
  if (!gl || reduced) {
    stage.classList.add("nogl");
    if (frame) frame.remove();
    rNodes.textContent = "—";
    rRender.textContent = gl ? "Static" : "No WebGL";
  } else {
    // The hero is the Pemberton Grand — 2,414 nodes, readable on any GPU tier.
    // Scale proves itself behind the CTA; comprehension is the front door.
    rNodes.textContent = fmt(2414);
    rRender.textContent = "WebGL";
    frame.addEventListener("load", function () { frame.classList.add("ready"); });
    frame.src = "./viewer/?file=/pemberton.booboo.json&chrome=0";
  }

  // Retarget every full-brain link to something this device survives.
  var full = FULL[t];
  Array.prototype.forEach.call(
    document.querySelectorAll('a[href="./viewer/?n=1000000"]'),
    function (a) {
      a.setAttribute("href", "./viewer/?n=" + full);
      if (full !== 1000000) {
        a.childNodes[0].nodeValue = "Open the " + fmt(full) + "-node brain ";
      }
    }
  );
  if (openFull && full !== 1000000) {
    openFull.title = "Scaled to this device. Open on a desktop for the full million.";
  }

  // Copy buttons
  Array.prototype.forEach.call(document.querySelectorAll(".copy"), function (btn) {
    btn.addEventListener("click", function () {
      var el = document.querySelector(btn.dataset.copy);
      if (!el) return;
      navigator.clipboard.writeText(el.textContent.trim()).then(function () {
        var was = btn.textContent;
        btn.textContent = "Copied";
        btn.classList.add("done");
        setTimeout(function () { btn.textContent = was; btn.classList.remove("done"); }, 1600);
      }).catch(function () {
        btn.textContent = "Copy failed";
        setTimeout(function () { btn.textContent = "Copy"; }, 1600);
      });
    });
  });
})();
