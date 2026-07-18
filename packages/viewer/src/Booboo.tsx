import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import { EffectComposer, Bloom, Vignette, ToneMapping, HueSaturation, BrightnessContrast } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import * as THREE from "three";
import type { BoobooGraph } from "@booboo-brain/spec";
import { layout, planeZ, PLANE_GAP, type Laid } from "./layout";
import { truncateLabel } from "./label";

// Effect intensities are numbers (sliders): 0 = off, 1 = default, >1 = more.
export type BoobooCfg = {
  orbit: number; // spin speed (wandering); 0 = off
  drift: number; // slow z-roll
  lines: number; // pulse-river edge intensity; 0 = off
  flow: number; // pulse travel speed
  nodeScale: number; // global node size
  sizes: Record<string, number>; // per-layer size
  layers: Record<string, boolean>; // per-layer visibility
  platforms: boolean; // the faint tier discs
  rings: boolean; // the glowing rim rings
  labels: boolean; // the floating tier labels
  bloom: number; // glow
  cinematic: number; // film grade (tone/contrast/vignette)
  fog: number; // frontier nebula
  peel: number; // tier spacing (z-scale)
};

export function defaultCfg(data: BoobooGraph): BoobooCfg {
  const layers: Record<string, boolean> = {};
  const sizes: Record<string, number> = {};
  data.meta.layers.forEach((l) => {
    layers[l.name] = true;
    sizes[l.name] = 1;
  });
  // bloom 0 is the signed-off default (the Atlas lesson: glow merges a dense field into
  // blobs). The sprite shader carries its own soft glow; bloom is an opt-in accent.
  return { orbit: 1, drift: 1, lines: 0.15, flow: 1, nodeScale: 1, sizes, layers, platforms: true, rings: true, labels: true, bloom: 0, cinematic: 1, fog: 0, peel: 1.2 };
}

// ── node cloud: one draw call, per-point size + color from typed-array attributes ──
// Sprite design (CRAFT luminance law): a soft luminous core, a thin rim ring that only
// appears on large (landmark-scale) sprites, and a depth fade so the far field recedes.
// The sprite carries its own glow — the de-bloomed default look needs no postprocessing.
const VERT = /* glsl */ `
  attribute float size; attribute vec3 color; attribute float focus;
  uniform float uT; uniform float uZTop; uniform float uZSpan;
  varying vec3 vColor; varying float vFade; varying float vPx;
  void main() { vColor = color * (0.45 + 0.55 * focus); vec4 mv = modelViewMatrix * vec4(position, 1.0);
    float px = size * (340.0 / -mv.z) * (0.8 + 0.26 * focus); // dimmed points also recede in size
    gl_PointSize = px; vPx = px;
    // entrance: the field wakes top-down after the spines (start 1.8s, wave 1.2s + 0.6s ease)
    float intro = clamp((uT - 1.8 - ((uZTop - position.z) / uZSpan) * 1.2) / 0.6, 0.0, 1.0);
    vFade = clamp(1.45 + mv.z / 9000.0, 0.3, 1.0) * (0.35 + 0.65 * focus) * intro;
    gl_Position = projectionMatrix * mv; }`;
const FRAG = /* glsl */ `
  precision mediump float; varying vec3 vColor; varying float vFade; varying float vPx;
  void main() {
    vec2 d = gl_PointCoord - vec2(0.5); float r = length(d) * 2.0;
    if (r > 1.0) discard;
    float core = exp(-r * r * 5.0);
    float rim = smoothstep(0.55, 0.72, r) * (1.0 - smoothstep(0.78, 1.0, r));
    rim *= smoothstep(7.0, 15.0, vPx);            // rings only on landmark-scale sprites
    float a = (core * 0.9 + rim * 0.24) * vFade;
    gl_FragColor = vec4(vColor * (0.85 + core * 0.55), a); }`;

// ── pulse-river edges: a light travels source→target along each (static) link ──
const PULSE_VERT = /* glsl */ `
  attribute vec3 aColor; attribute float aDist; attribute float aPhase; attribute float aFocus;
  uniform float uT; uniform float uZTop; uniform float uZSpan;
  varying vec3 vColor; varying float vDist; varying float vPhase; varying float vFocus; varying float vIntro;
  void main(){ vColor=aColor; vDist=aDist; vPhase=aPhase; vFocus=aFocus;
    // entrance: spines ignite top-down first — the law flows down (start 0.9s, wave 1.2s)
    vIntro = clamp((uT - 0.9 - ((uZTop - position.z) / uZSpan) * 1.2) / 0.5, 0.0, 1.0);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;
const PULSE_FRAG = /* glsl */ `
  precision mediump float; uniform float uTime,uBase,uPulse,uSpeed,uWidth;
  varying vec3 vColor; varying float vDist; varying float vPhase; varying float vFocus; varying float vIntro;
  void main(){ float head=fract(uTime*uSpeed+vPhase); float d=abs(vDist-head); d=min(d,1.0-d);
    float pulse=exp(-(d*d)/(uWidth*uWidth)); float a=(uBase+uPulse*pulse)*(0.15+0.85*vFocus)*vIntro;
    gl_FragColor=vec4(vColor*(1.0+pulse*1.5)*(0.55+0.9*vFocus), a); }`;

type IntroUni = { uT: { value: number }; uZTop: { value: number }; uZSpan: { value: number } };
type IntroBox = React.MutableRefObject<{ t0: number | null; skip: boolean; t: number }>;

// Drives the entrance clock: one shared set of uniform objects, written once per frame.
function IntroDriver({ uni, box }: { uni: IntroUni; box: IntroBox }) {
  useFrame(({ clock }) => {
    const b = box.current;
    if (b.t0 == null) b.t0 = clock.getElapsedTime();
    b.t = b.skip ? 1000 : clock.getElapsedTime() - b.t0;
    uni.uT.value = b.t;
  });
  return null;
}

function Field({ laid, cfg, onPick, focus, introUni }: { laid: Laid; cfg: BoobooCfg; onPick?: (i: number) => void; focus?: Float32Array | null; introUni: IntroUni }) {
  // Sizes are baked into the geometry (not mutated via needsUpdate, which didn't reliably
  // re-upload) so the cloud rebuilds — and re-renders — whenever a size/scale/visibility
  // slider changes. Rebuild only on size-affecting cfg, not on every cfg tick.
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(laid.positions, 3));
    g.setAttribute("color", new THREE.BufferAttribute(laid.colors, 3));
    const sizeArr = new Float32Array(laid.count);
    for (let i = 0; i < laid.count; i++) {
      const layer = laid.nodeLayer[i];
      const vis = cfg.layers[layer] !== false;
      sizeArr[i] = vis ? laid.sizes[i] * cfg.nodeScale * (cfg.sizes[layer] ?? 1) : 0;
    }
    // landmarks (tier<=1) render as brass objects, not points — zero them out of the cloud
    for (let i = 0; i < laid.count; i++) if (laid.nodeTier[i] <= 1) sizeArr[i] = 0;
    g.setAttribute("size", new THREE.BufferAttribute(sizeArr, 1));
    // torch focus: 1 = lit (selection + neighbourhood), sub-1 = dimmed. All-ones when idle.
    g.setAttribute("focus", new THREE.BufferAttribute(focus ?? new Float32Array(laid.count).fill(1), 1));
    return g;
  }, [laid, cfg.nodeScale, cfg.sizes, cfg.layers, focus]);
  useEffect(() => () => geo.dispose(), [geo]);
  // Additive glow is gorgeous on sparse graphs but saturates dense clusters to white.
  // In the de-bloomed look (bloom 0) fall back to normal blending so a 16k-node layer
  // reads as a coloured mass, not a blown-out core (matches the Operational Atlas cloud).
  // de-bloomed look (bloom 0) → normal blending so a dense layer reads as a colour mass, not a white core
  const mat = useMemo(() => new THREE.ShaderMaterial({ uniforms: { uT: introUni.uT, uZTop: introUni.uZTop, uZSpan: introUni.uZSpan }, vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, blending: cfg.bloom > 0 ? THREE.AdditiveBlending : THREE.NormalBlending }), [cfg.bloom > 0, introUni]);
  useEffect(() => () => mat.dispose(), [mat]);
  return <points geometry={geo} material={mat} frustumCulled={false} onClick={(e) => { if (e.index != null && onPick) { onPick(e.index); e.stopPropagation(); } }} />;
}

function PulseLinks({ laid, cfg, focus, introUni }: { laid: Laid; cfg: BoobooCfg; focus?: Float32Array | null; introUni: IntroUni }) {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const geo = useMemo(() => {
    const m = laid.linkCount;
    const aDist = new Float32Array(m * 2), aPhase = new Float32Array(m * 2);
    for (let i = 0; i < m; i++) { aDist[i * 2] = 0; aDist[i * 2 + 1] = 1; const ph = (i * 0.61803398875) % 1; aPhase[i * 2] = ph; aPhase[i * 2 + 1] = ph; }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(laid.linkPos, 3));
    g.setAttribute("aColor", new THREE.BufferAttribute(laid.linkColors, 3));
    g.setAttribute("aDist", new THREE.BufferAttribute(aDist, 1));
    g.setAttribute("aPhase", new THREE.BufferAttribute(aPhase, 1));
    g.setAttribute("aFocus", new THREE.BufferAttribute(focus ?? new Float32Array(m * 2).fill(1), 1));
    return g;
  }, [laid, focus]);
  useEffect(() => () => geo.dispose(), [geo]);
  const uni = useMemo(() => ({ uTime: { value: 0 }, uBase: { value: 0.05 }, uPulse: { value: 0.5 }, uSpeed: { value: 0.2 }, uWidth: { value: 0.14 }, uT: introUni.uT, uZTop: introUni.uZTop, uZSpan: introUni.uZSpan }), [introUni]);
  useFrame(({ clock }) => {
    const u = matRef.current?.uniforms; if (!u) return;
    u.uTime.value = clock.getElapsedTime();
    u.uBase.value = 0.09 * cfg.lines; u.uPulse.value = 0.6 * cfg.lines; u.uSpeed.value = 0.2 * cfg.flow;
  });
  if (cfg.lines <= 0 || laid.linkCount === 0) return null;
  return (
    <lineSegments geometry={geo} frustumCulled={false}>
      <shaderMaterial ref={matRef} uniforms={uni} vertexShader={PULSE_VERT} fragmentShader={PULSE_FRAG} transparent depthWrite={false} blending={cfg.bloom > 0 ? THREE.AdditiveBlending : THREE.NormalBlending} />
    </lineSegments>
  );
}

// ── landmarks (CRAFT: objects, not dots): tier<=1 nodes as faceted brass studs with a
// soft contact shadow on their band's floor. One InstancedMesh each; instance-picked.
const GOLD = new THREE.Color("#c9a04a");
function Landmarks({ data, laid, cfg, focus, sel, onSelect, introBox }: { data: BoobooGraph; laid: Laid; cfg: BoobooCfg; focus: Float32Array | null; sel?: string | null; onSelect?: (id: string | null) => void; introBox: IntroBox }) {
  const layerIdx = useMemo(() => {
    const m: Record<string, number> = {};
    data.meta.layers.forEach((l, i) => (m[l.name] = i));
    return m;
  }, [data]);
  const nL = Math.max(1, data.meta.layers.length);
  const items = useMemo(() => {
    const out: { i: number; r: number; z: number }[] = [];
    for (let i = 0; i < laid.count; i++) {
      if (laid.nodeTier[i] > 1) continue;
      if (cfg.layers[laid.nodeLayer[i]] === false) continue;
      out.push({ i, r: Math.max(6.5, laid.sizes[i] * 0.85), z: planeZ(layerIdx[laid.nodeLayer[i]] ?? 0, nL) });
    }
    return out;
  }, [laid, cfg.layers, layerIdx, nL]);
  const bodyRef = useRef<THREE.InstancedMesh>(null);
  const shadowRef = useRef<THREE.InstancedMesh>(null);
  const M = useMemo(() => new THREE.Matrix4(), []);
  // matrices + colours: once per items/focus change (a few hundred instances, trivial)
  useEffect(() => {
    const body = bodyRef.current, shadow = shadowRef.current;
    if (!body || !shadow) return;
    const c = new THREE.Color();
    for (let k = 0; k < items.length; k++) {
      const { i, r, z } = items[k];
      const x = laid.positions[i * 3], y = laid.positions[i * 3 + 1], zz = laid.positions[i * 3 + 2];
      M.makeScale(r, r, r).setPosition(x, y, zz);
      body.setMatrixAt(k, M);
      M.makeScale(r * 1.7, r * 1.7, 1).setPosition(x, y, z + 0.9);
      shadow.setMatrixAt(k, M);
      c.setRGB(laid.colors[i * 3], laid.colors[i * 3 + 1], laid.colors[i * 3 + 2]).lerp(GOLD, 0.3);
      const f = focus ? focus[i] : 1;
      c.multiplyScalar(0.35 + 0.75 * f);
      body.setColorAt(k, c);
    }
    body.instanceMatrix.needsUpdate = true;
    shadow.instanceMatrix.needsUpdate = true;
    if (body.instanceColor) body.instanceColor.needsUpdate = true;
    body.count = items.length;
    shadow.count = items.length;
  }, [items, laid, focus, M]);
  // entrance: the cast arrives after the floors, before the field wakes (1.0 → 1.8s)
  useFrame(() => {
    const body = bodyRef.current; if (!body) return;
    const t = introBox.current.t;
    const e = Math.min(1, Math.max(0, (t - 1.0) / 0.8));
    const s = 1 - Math.pow(1 - e, 3);
    body.visible = s > 0.02;
    if (shadowRef.current) shadowRef.current.visible = body.visible;
    body.scale.setScalar(Math.max(0.001, s));
  });
  if (items.length === 0) return null;
  return (
    <>
      <instancedMesh
        ref={bodyRef}
        args={[undefined, undefined, Math.max(1, items.length)]}
        frustumCulled={false}
        onClick={(e) => { const iid = e.instanceId; if (iid != null && onSelect) { onSelect(laid.ids[items[iid].i]); e.stopPropagation(); } }}
      >
        <icosahedronGeometry args={[1, 0]} />
        <meshStandardMaterial metalness={0.82} roughness={0.34} flatShading emissive="#1a1408" emissiveIntensity={0.6} />
      </instancedMesh>
      <instancedMesh ref={shadowRef} args={[undefined, undefined, Math.max(1, items.length)]} frustumCulled={false} raycast={() => null}>
        <circleGeometry args={[1, 24]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.32} depthWrite={false} toneMapped={false} />
      </instancedMesh>
    </>
  );
}

// ── the observatory floor (CRAFT): glass disc with a radial gradient, etched concentric
// rules, the band name ENGRAVED on the surface clock-face style, a thin rim, and a slow
// breath. Luminance ladder: disc 0.06 · etchings 0.10 — substrate, never spectacle.
const DISC_FRAG = /* glsl */ `
  precision mediump float; varying vec2 vUv; uniform vec3 uTint; uniform float uOp;
  void main() {
    float r = length(vUv - 0.5) * 2.0;
    if (r > 1.0) discard;
    // glass: dark well at the centre lifting to a tinted mid, easing off before the rim
    float grad = smoothstep(0.05, 0.8, r) * (1.0 - 0.45 * smoothstep(0.86, 1.0, r));
    // etched rules at quarter radii — hairlines, not rings of their own
    float q = fract(r * 4.0); float rule = 1.0 - smoothstep(0.0, 0.016, min(q, 1.0 - q));
    // fine minute-ticks just inside the rim: 60 thin marks, whisper-level
    float ang = atan(vUv.y - 0.5, vUv.x - 0.5);
    float td = abs(fract(ang * 9.5493) - 0.5) * 2.0;
    float tick = smoothstep(0.9, 0.985, td)
               * smoothstep(0.948, 0.956, r) * (1.0 - smoothstep(0.982, 0.996, r));
    float a = uOp * (grad + rule * 0.3 + tick * 0.4);
    gl_FragColor = vec4(uTint * (1.0 + rule * 0.22 + tick * 0.25), a);
  }`;
const DISC_VERT = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

// The band name drawn along an arc into a CanvasTexture — engraved into the floor.
function arcLabelTexture(label: string, color: string): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const S = 1024;
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const x = c.getContext("2d");
  if (!x) return null;
  const rad = S * 0.40;
  // scale with label length so long band names hold a dignified ~90° arc, never a pile
  const px = S * Math.min(0.044, 0.6 / Math.max(8, label.length));
  x.font = `600 ${px}px ui-monospace, SFMono-Regular, monospace`;
  x.textAlign = "center";
  x.textBaseline = "middle";
  const chars = (label.toUpperCase()) .split("");
  const step = (px * 1.18) / rad; // arc advance per character (incl. tracking)
  let a = -Math.PI / 2 - (step * (chars.length - 1)) / 2;
  for (const ch of chars) {
    x.save();
    x.translate(S / 2 + Math.cos(a) * rad, S / 2 + Math.sin(a) * rad);
    x.rotate(a + Math.PI / 2);
    x.fillStyle = "rgba(0,0,0,0.85)"; x.fillText(ch, 1.5, 1.5); // engrave shadow
    x.fillStyle = color; x.fillText(ch, 0, 0);
    x.restore();
    a += step;
  }
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 8;
  return t;
}

function Platform({ z, color, label, radius, planes, rings, labels, introBox, introDelay = 0 }: { z: number; color: string; label: string; radius: number; planes: boolean; rings: boolean; labels: boolean; introBox?: IntroBox; introDelay?: number }) {
  const grp = useRef<THREE.Group>(null);
  const tint = useMemo(() => new THREE.Color(color), [color]);
  const uni = useMemo(() => ({ uTint: { value: tint }, uOp: { value: 0.055 } }), [tint]);
  // floor engraving carries only the short rank word; the rim label + legend carry the rest
  const engraved = useMemo(() => label.split("·")[0].trim() || label, [label]);
  const tex = useMemo(() => (labels ? arcLabelTexture(engraved, color) : null), [labels, engraved, color]);
  useEffect(() => () => { tex?.dispose(); }, [tex]);
  // breath ±0.3% phase-offset per band; entrance rises each disc into place bottom-up
  useFrame(({ clock }) => {
    const g = grp.current; if (!g) return;
    const t = introBox?.current.t ?? 1000;
    const e = Math.min(1, Math.max(0, (t - introDelay) / 0.7));
    const ease = 1 - Math.pow(1 - e, 3); // settle
    const s = (1 + Math.sin(clock.getElapsedTime() * 0.35 + z * 0.011) * 0.003) * (0.94 + 0.06 * ease);
    g.scale.set(s, s, 1);
    g.position.z = z - 50 * (1 - ease);
    g.visible = e > 0.001;
  });
  return (
    <group ref={grp} position={[0, 0, z]}>
      {planes && (
        <mesh>
          <circleGeometry args={[radius, 96]} />
          <shaderMaterial vertexShader={DISC_VERT} fragmentShader={DISC_FRAG} uniforms={uni} transparent depthWrite={false} side={THREE.DoubleSide} toneMapped={false} />
        </mesh>
      )}
      {rings && <mesh><torusGeometry args={[radius, radius * 0.0028, 8, 140]} /><meshBasicMaterial color={color} transparent opacity={0.55} toneMapped={false} /></mesh>}
      {labels && tex && (
        <mesh position={[0, 0, 0.6]}>
          <circleGeometry args={[radius * 1.0, 64]} />
          <meshBasicMaterial map={tex} transparent opacity={0.48} depthWrite={false} toneMapped={false} />
        </mesh>
      )}
      {labels && (
        <Html position={[radius * 1.04, 0, 0]} center style={{ pointerEvents: "none" }}>
          <div style={{ color, font: "10px var(--font-jetbrains, ui-monospace), monospace", letterSpacing: 3, opacity: 0.55, whiteSpace: "nowrap", textShadow: "0 0 8px rgba(0,0,0,.95)" }}>{label}</div>
        </Html>
      )}
    </group>
  );
}

// Faint void of distant stars (cosmic depth), scaled to the graph extent.
function Starfield({ scale }: { scale: number }) {
  const ref = useRef<THREE.Points>(null);
  const { geo, mat } = useMemo(() => {
    const N = 1300, pos = new Float32Array(N * 3), col = new Float32Array(N * 3), c = new THREE.Color();
    for (let i = 0; i < N; i++) {
      const a = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1), r = (50 + Math.random() * 38) * scale;
      pos[i * 3] = Math.cos(a) * Math.sin(ph) * r; pos[i * 3 + 1] = Math.sin(a) * Math.sin(ph) * r; pos[i * 3 + 2] = Math.cos(ph) * r * 0.7;
      const tw = 0.4 + Math.random() * 0.6; c.setHSL(0.58 + Math.random() * 0.12, 0.25, 0.55 * tw);
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    const m = new THREE.PointsMaterial({ size: 0.16 * scale, sizeAttenuation: true, vertexColors: true, transparent: true, opacity: 0.75, depthWrite: false });
    return { geo: g, mat: m };
  }, [scale]);
  useEffect(() => () => { geo.dispose(); mat.dispose(); }, [geo, mat]);
  useFrame((_, dt) => { if (ref.current) ref.current.rotation.z += dt * 0.003; });
  return <points ref={ref} geometry={geo} material={mat} frustumCulled={false} />;
}

// Soft drifting clouds at the edge of the known graph.
const FOG_VERT = /* glsl */ `attribute float aSize; attribute vec3 aColor; varying vec3 vC;
  void main(){ vC=aColor; vec4 mv=modelViewMatrix*vec4(position,1.0);
    gl_PointSize=aSize*(60.0/-mv.z); gl_Position=projectionMatrix*mv; }`;
const FOG_FRAG = /* glsl */ `precision mediump float; uniform float uOp; varying vec3 vC;
  void main(){ vec2 d=gl_PointCoord-vec2(0.5); float r=length(d);
    if(r>0.5) discard; float a=smoothstep(0.5,0.0,r)*uOp; gl_FragColor=vec4(vC,a); }`;
function FrontierFog({ scale, amount }: { scale: number; amount: number }) {
  const ref = useRef<THREE.Points>(null);
  const { geo, mat } = useMemo(() => {
    const COUNT = 700;
    const pos = new Float32Array(COUNT * 3), col = new Float32Array(COUNT * 3), siz = new Float32Array(COUNT);
    const pal = [new THREE.Color("#4a6cb8"), new THREE.Color("#7152a8"), new THREE.Color("#3a72a8"), new THREE.Color("#8a6a48"), new THREE.Color("#5a82c0")];
    for (let i = 0; i < COUNT; i++) {
      const a = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1), r = (11 + Math.random() * 13) * scale;
      pos[i * 3] = Math.cos(a) * Math.sin(ph) * r; pos[i * 3 + 1] = Math.sin(a) * Math.sin(ph) * r * 0.85; pos[i * 3 + 2] = Math.cos(ph) * r * 0.6;
      const c = pal[(Math.random() * pal.length) | 0]; col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
      siz[i] = (100 + Math.random() * 150) * scale;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aColor", new THREE.BufferAttribute(col, 3));
    g.setAttribute("aSize", new THREE.BufferAttribute(siz, 1));
    const m = new THREE.ShaderMaterial({ uniforms: { uOp: { value: 0.3 } }, vertexShader: FOG_VERT, fragmentShader: FOG_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    return { geo: g, mat: m };
  }, [scale]);
  useEffect(() => () => { geo.dispose(); mat.dispose(); }, [geo, mat]);
  useFrame(({ clock }, dt) => { if (ref.current) { ref.current.rotation.z += dt * 0.012; (ref.current.material as THREE.ShaderMaterial).uniforms.uOp.value = 0.3 * amount; } });
  if (amount <= 0) return null;
  return <points ref={ref} geometry={geo} material={mat} frustumCulled={false} />;
}

// The graph + platforms spin together (slow wandering turn so every face shows). peel = z-scale (tier spacing).
function Spin({ orbit, drift, peel, children }: { orbit: number; drift: number; peel: number; children: React.ReactNode }) {
  const grp = useRef<THREE.Group>(null);
  useFrame(({ clock }, dt) => {
    const g = grp.current; if (!g) return;
    g.rotation.z += dt * 0.006 * drift;
    if (orbit <= 0) return;
    const t = clock.getElapsedTime();
    const wy = 0.13 + 0.17 * Math.sin(t * 0.047) + 0.1 * Math.sin(t * 0.019 + 1.3) + 0.05 * Math.sin(t * 0.101 + 2.1);
    g.rotation.y += dt * orbit * wy;
  });
  return <group ref={grp} scale={[1, 1, Math.max(0.05, peel)]}>{children}</group>;
}

// Absolute cap on DOM label portals: many sparse layers could otherwise spawn thousands of
// per-frame <Html> portals. Keep the per-layer count gate; cap the total at top-N by weight.
const MAX_LABELS = 150;

// Labels for nodes in sparse tiers (+ the root) — the structural nodes. Dense tiers stay unlabelled (no clutter).
function NodeLabels({ data, laid }: { data: BoobooGraph; laid: Laid }) {
  const items = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const n of data.nodes) counts[n.layer] = (counts[n.layer] ?? 0) + 1;
    let out: { id: string; label: string; pos: [number, number, number]; weight: number }[] = [];
    for (const n of data.nodes) {
      if ((counts[n.layer] ?? 0) > 12 && n.id !== data.meta.root) continue; // ponytail: count gate, no de-clutter solver
      const i = laid.index.get(n.id);
      if (i == null) continue;
      out.push({ id: n.id, label: truncateLabel(n.label), pos: [laid.positions[i * 3], laid.positions[i * 3 + 1], laid.positions[i * 3 + 2]], weight: n.weight ?? 0 });
    }
    if (out.length > MAX_LABELS) out = out.sort((a, b) => b.weight - a.weight).slice(0, MAX_LABELS); // global cap: top-N by weight
    return out;
  }, [data, laid]);
  return (
    <>
      {items.map((it) => (
        <Html key={it.id} position={it.pos} center style={{ pointerEvents: "none" }}>
          <div style={{ color: "#E8DCC4", font: "11px var(--font-jetbrains, ui-monospace), monospace", letterSpacing: 0.4, whiteSpace: "nowrap", textShadow: "0 0 7px rgba(0,0,0,.95)", transform: "translateY(-14px)" }}>{it.label}</div>
        </Html>
      ))}
    </>
  );
}

/** The core scene. Give it a Booboo graph (+ optional cfg); it lays out + renders the tiered field. */
export function Booboo({ data, cfg, onSelect, sel, intro = true }: { data: BoobooGraph; cfg?: BoobooCfg; onSelect?: (id: string | null) => void; sel?: string | null; intro?: boolean }) {
  const laid = useMemo(() => layout(data), [data]);
  const c = useMemo(() => cfg ?? defaultCfg(data), [cfg, data]);
  const nL = Math.max(1, data.meta.layers.length);
  // ── entrance (CRAFT): discs rise bottom-up → spines ignite top-down → field wakes.
  // Skippable on any input; prefers-reduced-motion gets the final frame immediately.
  const reduced = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const introBox: IntroBox = useRef({ t0: null, skip: !intro || !!reduced, t: 0 });
  const introUni = useMemo<IntroUni>(() => ({
    uT: { value: 1000 },
    uZTop: { value: ((nL - 1) / 2) * PLANE_GAP },
    uZSpan: { value: Math.max(1, (nL - 1) * PLANE_GAP) },
  }), [nL]);
  useEffect(() => {
    if (introBox.current.skip) return;
    const skip = () => { introBox.current.skip = true; };
    window.addEventListener("pointerdown", skip);
    window.addEventListener("keydown", skip);
    const done = setTimeout(() => {
      window.removeEventListener("pointerdown", skip);
      window.removeEventListener("keydown", skip);
    }, 4200);
    return () => { clearTimeout(done); window.removeEventListener("pointerdown", skip); window.removeEventListener("keydown", skip); };
  }, []);
  const radius = laid.bounds;
  const platR = radius * 1.06;
  const half = ((nL - 1) / 2) * PLANE_GAP * c.peel;
  const cam = radius * 4.0 + half * 1.0 + 300;
  // ── torch focus (CRAFT): selection lights its neighbourhood; the rest recedes.
  // One O(links) scan per selection change → per-node + per-link-vertex focus buffers.
  const focus = useMemo(() => {
    if (!sel) return { node: null as Float32Array | null, link: null as Float32Array | null };
    const si = laid.index.get(sel);
    if (si == null) return { node: null, link: null };
    const nf = new Float32Array(laid.count).fill(0.12);
    nf[si] = 1;
    const lf = new Float32Array(laid.linkCount * 2).fill(0.06);
    let k = 0;
    for (const l of data.links) {
      const a = laid.index.get(l.source), b = laid.index.get(l.target);
      if (a == null || b == null) continue;
      const na = data.nodes[a], nb = data.nodes[b];
      const spine = l.type === "spine" || l.type === "tether";
      if (!spine && (na.tier ?? 2) > 1 && (nb.tier ?? 2) > 1) continue; // mirrors layout culling
      if (a === si || b === si) {
        lf[k * 2] = 1; lf[k * 2 + 1] = 1;
        nf[a] = Math.max(nf[a], 0.95); nf[b] = Math.max(nf[b], 0.95);
      }
      k++;
    }
    return { node: nf, link: lf };
  }, [sel, laid, data]);
  return (
    <Canvas
      camera={{ position: [0, -cam * 0.55, cam * 0.82], far: cam * 22, near: cam * 0.02, fov: 24 }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      dpr={[1, 2]}
      raycaster={{ params: { Points: { threshold: Math.max(6, radius * 0.012) } } as THREE.RaycasterParameters }}
      onPointerMissed={() => onSelect?.(null)}
    >
      <color attach="background" args={["#06080e"]} />
      {/* lights exist for the brass landmarks only — every other material is Basic/Shader */}
      <hemisphereLight args={["#2a3350", "#06080e", 0.85]} />
      <directionalLight position={[radius * 0.6, -radius * 1.2, radius * 1.6]} intensity={1.25} color="#fff4e0" />
      <directionalLight position={[-radius, radius * 0.5, radius * 0.4]} intensity={0.35} color="#c9a04a" />
      <IntroDriver uni={introUni} box={introBox} />
      <Starfield scale={radius / 12} />
      <FrontierFog scale={radius / 12} amount={c.fog} />
      <Spin orbit={c.orbit} drift={c.drift} peel={c.peel}>
        {data.meta.layers.map((l, i) => (
          (c.layers[l.name] !== false) && <Platform key={l.name} z={planeZ(i, nL)} color={l.color || "#7a8aa0"} label={l.label || l.name} radius={platR} planes={c.platforms} rings={c.rings} labels={c.labels} introBox={introBox} introDelay={(nL - 1 - i) * 0.18} />
        ))}
        <PulseLinks laid={laid} cfg={c} focus={focus.link} introUni={introUni} />
        <Field laid={laid} cfg={c} onPick={(i) => onSelect?.(laid.ids[i])} focus={focus.node} introUni={introUni} />
        <Landmarks data={data} laid={laid} cfg={c} focus={focus.node} sel={sel} onSelect={onSelect} introBox={introBox} />
        {c.labels && <NodeLabels data={data} laid={laid} />}
      </Spin>
      <OrbitControls autoRotate={false} enableRotate enableZoom enablePan screenSpacePanning enableDamping dampingFactor={0.08} target={[0, 0, 0]} minPolarAngle={0} maxPolarAngle={Math.PI} makeDefault />
      <EffectComposer>
        {/* selective bloom: threshold 0.62 (the Atlas value) so only assigned emissives
            — flags, pulses, the root — catch it when bloom is enabled at all */}
        <Bloom mipmapBlur intensity={c.bloom} luminanceThreshold={0.62} luminanceSmoothing={0.3} radius={0.7} />
        <HueSaturation saturation={0.12 * c.cinematic} />
        <BrightnessContrast brightness={0} contrast={0.08 * c.cinematic} />
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        <Vignette eskil={false} offset={0.28} darkness={0.7 * Math.max(0, c.cinematic)} />
      </EffectComposer>
    </Canvas>
  );
}
