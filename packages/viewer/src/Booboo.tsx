import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import { EffectComposer, Bloom, Vignette, ToneMapping, HueSaturation, BrightnessContrast } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import * as THREE from "three";
import type { BoobooGraph } from "@booboo-brain/spec";
import { layout, planeZ, PLANE_GAP, type Laid } from "./layout";

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
  return { orbit: 1, drift: 1, lines: 0.15, flow: 1, nodeScale: 1, sizes, layers, platforms: true, rings: true, labels: true, bloom: 0.45, cinematic: 1, fog: 0, peel: 1.2 };
}

// ── node cloud: one draw call, per-point size + color from typed-array attributes ──
const VERT = /* glsl */ `
  attribute float size; attribute vec3 color; varying vec3 vColor;
  void main() { vColor = color; vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = size * (320.0 / -mv.z); gl_Position = projectionMatrix * mv; }`;
const FRAG = /* glsl */ `
  precision mediump float; varying vec3 vColor;
  void main() { vec2 d = gl_PointCoord - vec2(0.5); float r2 = dot(d, d);
    if (r2 > 0.25) discard; float a = smoothstep(0.25, 0.02, r2);
    gl_FragColor = vec4(vColor * 1.45, a); }`;  // *1.45 so bright nodes catch the bloom

// ── pulse-river edges: a light travels source→target along each (static) link ──
const PULSE_VERT = /* glsl */ `
  attribute vec3 aColor; attribute float aDist; attribute float aPhase;
  varying vec3 vColor; varying float vDist; varying float vPhase;
  void main(){ vColor=aColor; vDist=aDist; vPhase=aPhase;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;
const PULSE_FRAG = /* glsl */ `
  precision mediump float; uniform float uTime,uBase,uPulse,uSpeed,uWidth;
  varying vec3 vColor; varying float vDist; varying float vPhase;
  void main(){ float head=fract(uTime*uSpeed+vPhase); float d=abs(vDist-head); d=min(d,1.0-d);
    float pulse=exp(-(d*d)/(uWidth*uWidth)); float a=uBase+uPulse*pulse;
    gl_FragColor=vec4(vColor*(1.0+pulse*1.5), a); }`;

function Field({ laid, cfg, onPick }: { laid: Laid; cfg: BoobooCfg; onPick?: (i: number) => void }) {
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(laid.positions, 3));
    g.setAttribute("color", new THREE.BufferAttribute(laid.colors, 3));
    g.setAttribute("size", new THREE.BufferAttribute(new Float32Array(laid.count), 1));
    return g;
  }, [laid]);
  useEffect(() => () => geo.dispose(), [geo]);
  useEffect(() => {
    const attr = geo.getAttribute("size") as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;
    for (let i = 0; i < laid.count; i++) {
      const layer = laid.nodeLayer[i];
      const vis = cfg.layers[layer] !== false;
      arr[i] = vis ? laid.sizes[i] * cfg.nodeScale * (cfg.sizes[layer] ?? 1) : 0;
    }
    attr.needsUpdate = true;
  }, [geo, laid, cfg.nodeScale, cfg.sizes, cfg.layers]);
  // Additive glow is gorgeous on sparse graphs but saturates dense clusters to white.
  // In the de-bloomed look (bloom 0) fall back to normal blending so a 16k-node layer
  // reads as a coloured mass, not a blown-out core (matches the Operational Atlas cloud).
  // de-bloomed look (bloom 0) → normal blending so a dense layer reads as a colour mass, not a white core
  const mat = useMemo(() => new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, blending: cfg.bloom > 0 ? THREE.AdditiveBlending : THREE.NormalBlending }), [cfg.bloom > 0]);
  useEffect(() => () => mat.dispose(), [mat]);
  return <points geometry={geo} material={mat} frustumCulled={false} onClick={(e) => { if (e.index != null && onPick) { onPick(e.index); e.stopPropagation(); } }} />;
}

function PulseLinks({ laid, cfg }: { laid: Laid; cfg: BoobooCfg }) {
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
    return g;
  }, [laid]);
  useEffect(() => () => geo.dispose(), [geo]);
  const uni = useMemo(() => ({ uTime: { value: 0 }, uBase: { value: 0.05 }, uPulse: { value: 0.5 }, uSpeed: { value: 0.2 }, uWidth: { value: 0.14 } }), []);
  useFrame(({ clock }) => {
    const u = matRef.current?.uniforms; if (!u) return;
    u.uTime.value = clock.getElapsedTime();
    u.uBase.value = 0.09 * cfg.lines; u.uPulse.value = 0.6 * cfg.lines; u.uSpeed.value = 0.2 * cfg.flow;
  });
  if (cfg.lines <= 0 || laid.linkCount === 0) return null;
  return (
    <lineSegments geometry={geo} frustumCulled={false}>
      <shaderMaterial ref={matRef} uniforms={uni} vertexShader={PULSE_VERT} fragmentShader={PULSE_FRAG} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
    </lineSegments>
  );
}

// A tier shelf: faint disc + glowing rim ring + floating layer label (the Atlas tier language).
function Platform({ z, color, label, radius, planes, rings, labels }: { z: number; color: string; label: string; radius: number; planes: boolean; rings: boolean; labels: boolean }) {
  return (
    <group position={[0, 0, z]}>
      {planes && <mesh><circleGeometry args={[radius, 80]} /><meshBasicMaterial color={color} transparent opacity={0.05} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} /></mesh>}
      {rings && <mesh><torusGeometry args={[radius, radius * 0.004, 8, 120]} /><meshBasicMaterial color={color} transparent opacity={0.6} toneMapped={false} /></mesh>}
      {labels && (
        <Html position={[radius * 1.04, 0, 0]} center style={{ pointerEvents: "none" }}>
          <div style={{ color, font: "11px var(--font-jetbrains, ui-monospace), monospace", letterSpacing: 3, opacity: 0.85, whiteSpace: "nowrap", textShadow: "0 0 8px rgba(0,0,0,.95)" }}>{label}</div>
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
      out.push({ id: n.id, label: n.label, pos: [laid.positions[i * 3], laid.positions[i * 3 + 1], laid.positions[i * 3 + 2]], weight: n.weight ?? 0 });
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
export function Booboo({ data, cfg, onSelect }: { data: BoobooGraph; cfg?: BoobooCfg; onSelect?: (id: string | null) => void }) {
  const laid = useMemo(() => layout(data), [data]);
  const c = useMemo(() => cfg ?? defaultCfg(data), [cfg, data]);
  const nL = Math.max(1, data.meta.layers.length);
  const radius = laid.bounds;
  const platR = radius * 1.06;
  const half = ((nL - 1) / 2) * PLANE_GAP * c.peel;
  const cam = radius * 4.0 + half * 1.0 + 300;
  return (
    <Canvas
      camera={{ position: [0, -cam * 0.55, cam * 0.82], far: cam * 22, near: cam * 0.02, fov: 24 }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      dpr={[1, 2]}
      raycaster={{ params: { Points: { threshold: Math.max(6, radius * 0.012) } } as THREE.RaycasterParameters }}
      onPointerMissed={() => onSelect?.(null)}
    >
      <color attach="background" args={["#06080e"]} />
      <Starfield scale={radius / 12} />
      <FrontierFog scale={radius / 12} amount={c.fog} />
      <Spin orbit={c.orbit} drift={c.drift} peel={c.peel}>
        {data.meta.layers.map((l, i) => (
          (c.layers[l.name] !== false) && <Platform key={l.name} z={planeZ(i, nL)} color={l.color || "#7a8aa0"} label={l.label || l.name} radius={platR} planes={c.platforms} rings={c.rings} labels={c.labels} />
        ))}
        <PulseLinks laid={laid} cfg={c} />
        <Field laid={laid} cfg={c} onPick={(i) => onSelect?.(laid.ids[i])} />
        {c.labels && <NodeLabels data={data} laid={laid} />}
      </Spin>
      <OrbitControls autoRotate={false} enableRotate enableZoom enablePan screenSpacePanning enableDamping dampingFactor={0.08} target={[0, 0, 0]} minPolarAngle={0} maxPolarAngle={Math.PI} makeDefault />
      <EffectComposer>
        <Bloom mipmapBlur intensity={c.bloom} luminanceThreshold={0.4} luminanceSmoothing={0.3} radius={0.7} />
        <HueSaturation saturation={0.12 * c.cinematic} />
        <BrightnessContrast brightness={0} contrast={0.08 * c.cinematic} />
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        <Vignette eskil={false} offset={0.28} darkness={0.7 * Math.max(0, c.cinematic)} />
      </EffectComposer>
    </Canvas>
  );
}
