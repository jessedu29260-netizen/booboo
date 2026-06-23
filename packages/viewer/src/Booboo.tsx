import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import type { BoobooGraph } from "@booboo/spec";
import { layout, type Laid } from "./layout";

export type BoobooCfg = {
  orbit: number; // wandering orbit speed: 0 = off, 1 = default, higher = faster
  lines: boolean;
  lineOpacity: number; // 0..0.4
  nodeScale: number; // 0.3..2.5 — global size multiplier
  sizes: Record<string, number>; // per-layer size multiplier (0.2..3); absent = 1
  layers: Record<string, boolean>; // per-layer visibility; absent = visible
};

export function defaultCfg(data: BoobooGraph): BoobooCfg {
  const layers: Record<string, boolean> = {};
  const sizes: Record<string, number> = {};
  data.meta.layers.forEach((l) => {
    layers[l.name] = true;
    sizes[l.name] = 1;
  });
  return { orbit: 1, lines: true, lineOpacity: 0.13, nodeScale: 1, sizes, layers };
}

// One draw call for the whole node cloud. Per-point size + color from typed-array attributes.
const VERT = /* glsl */ `
  attribute float size;
  attribute vec3 color;
  varying vec3 vColor;
  void main() {
    vColor = color;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = size * (320.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;
const FRAG = /* glsl */ `
  precision mediump float;
  varying vec3 vColor;
  void main() {
    vec2 d = gl_PointCoord - vec2(0.5);
    float r2 = dot(d, d);
    if (r2 > 0.25) discard;
    float a = smoothstep(0.25, 0.02, r2);
    gl_FragColor = vec4(vColor, a);
  }
`;

function Field({ laid, cfg, onPick }: { laid: Laid; cfg: BoobooCfg; onPick?: (i: number) => void }) {
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(laid.positions, 3));
    g.setAttribute("color", new THREE.BufferAttribute(laid.colors, 3));
    g.setAttribute("size", new THREE.BufferAttribute(new Float32Array(laid.count), 1));
    return g;
  }, [laid]);
  useEffect(() => () => geo.dispose(), [geo]); // free GPU buffers when the graph swaps / unmounts

  // Recompute only the size attribute on nodeScale / per-layer size / layer-visibility change (cheap, occasional).
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

  const mat = useMemo(
    () => new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, blending: THREE.NormalBlending }),
    [],
  );
  useEffect(() => () => mat.dispose(), [mat]);
  return (
    <points
      geometry={geo}
      material={mat}
      onClick={(e) => {
        if (e.index != null && onPick) {
          onPick(e.index);
          e.stopPropagation();
        }
      }}
    />
  );
}

function Links({ laid, cfg }: { laid: Laid; cfg: BoobooCfg }) {
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(laid.linkPos, 3));
    g.setAttribute("color", new THREE.BufferAttribute(laid.linkColors, 3));
    return g;
  }, [laid]);
  useEffect(() => () => geo.dispose(), [geo]);
  if (!cfg.lines || laid.linkCount === 0) return null;
  return (
    <lineSegments geometry={geo}>
      <lineBasicMaterial vertexColors transparent opacity={cfg.lineOpacity} depthWrite={false} />
    </lineSegments>
  );
}

// Field + Links spin together (nodes stay attached to their edges). orbit = a WANDERING
// turn (sum of slow sines → speeds up, slows, even reverses) so every face shows.
function Spin({ orbit, children }: { orbit: number; children: React.ReactNode }) {
  const grp = useRef<THREE.Group>(null);
  useFrame(({ clock }, dt) => {
    const g = grp.current;
    if (!g || orbit <= 0) return;
    const t = clock.getElapsedTime();
    const wy = 0.13 + 0.17 * Math.sin(t * 0.047) + 0.1 * Math.sin(t * 0.019 + 1.3) + 0.05 * Math.sin(t * 0.101 + 2.1);
    g.rotation.y += dt * orbit * wy;
  });
  return <group ref={grp}>{children}</group>;
}

/** The core scene. Give it a Booboo graph (+ optional cfg); it lays out + renders one instanced field. */
export function Booboo({ data, cfg, onSelect }: { data: BoobooGraph; cfg?: BoobooCfg; onSelect?: (id: string | null) => void }) {
  const laid = useMemo(() => layout(data), [data]);
  const c = useMemo(() => cfg ?? defaultCfg(data), [cfg, data]);
  const cam = laid.bounds * 1.7 + 240;
  return (
    <Canvas
      camera={{ position: [0, -cam * 0.65, cam * 0.9], far: cam * 12, fov: 55 }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      raycaster={{ params: { Points: { threshold: Math.max(6, laid.bounds * 0.012) } } as THREE.RaycasterParameters }}
      style={{ background: "#06080e" }}
      onPointerMissed={() => onSelect?.(null)}
    >
      <Spin orbit={c.orbit}>
        <Links laid={laid} cfg={c} />
        <Field laid={laid} cfg={c} onPick={(i) => onSelect?.(laid.ids[i])} />
      </Spin>
      <OrbitControls autoRotate={false} enableRotate enableZoom enablePan screenSpacePanning enableDamping dampingFactor={0.08} minPolarAngle={0} maxPolarAngle={Math.PI} makeDefault />
    </Canvas>
  );
}
