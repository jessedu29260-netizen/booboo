import type { BoobooGraph } from "@booboo/spec";

// O(n) deterministic layout → flat typed arrays. Scale-first: no per-node objects, no force sim.
// Position = f(layer-plane, cluster-sector, tier-radius, hash(id)). Same input → same output.

export type Laid = {
  ids: string[];
  index: Map<string, number>;
  nodeLayer: string[]; // layer name per node index (for layer-isolation toggles)
  positions: Float32Array; // n*3
  colors: Float32Array; // n*3
  sizes: Float32Array; // n
  linkPos: Float32Array; // k*6 (two endpoints, dangling dropped)
  linkColors: Float32Array; // k*6
  bounds: number; // rough half-extent for camera framing
  count: number;
  linkCount: number;
};

export const PLANE_GAP = 170; // gap between the stacked tier planes (along Z); a labelled platform sits at each plane

/** Z of a layer's plane. Apex (index 0) on top → highest Z; the last layer sits at the floor. */
export const planeZ = (layerIndex: number, nLayers: number) => ((nLayers - 1) / 2 - layerIndex) * PLANE_GAP;

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1000000) / 1000000;
}

function hex2rgb(hex?: string | null): [number, number, number] {
  if (!hex) return [0.7, 0.7, 0.7];
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export function layout(g: BoobooGraph): Laid {
  const nodes = g.nodes;
  const n = nodes.length;
  const index = new Map<string, number>();
  const ids: string[] = new Array(n);
  const nodeLayer: string[] = new Array(n);
  for (let i = 0; i < n; i++) {
    index.set(nodes[i].id, i);
    ids[i] = nodes[i].id;
    nodeLayer[i] = nodes[i].layer;
  }

  const layerOrder: Record<string, number> = {};
  g.meta.layers.forEach((l, i) => (layerOrder[l.name] = i));
  const nLayers = Math.max(1, g.meta.layers.length);
  const layerColor: Record<string, [number, number, number]> = {};
  g.meta.layers.forEach((l) => (layerColor[l.name] = hex2rgb(l.color)));

  const positions = new Float32Array(n * 3);
  const colors = new Float32Array(n * 3);
  const sizes = new Float32Array(n);
  let bounds = 1;

  for (let i = 0; i < n; i++) {
    const nd = nodes[i];
    const li = layerOrder[nd.layer] ?? 0;
    // Each layer is a disc in its own plane; planes stack along Z (apex on top, floor at bottom).
    const pz = planeZ(li, nLayers);
    let x: number, y: number, z: number;

    if (nd.x != null && nd.y != null) {
      x = nd.x;
      y = nd.y;
      z = nd.z != null ? nd.z : pz;
    } else if (nd.id === g.meta.root) {
      x = 0;
      y = 0;
      z = pz;
    } else {
      const sectorKey = nd.cluster ?? nd.parent ?? nd.type;
      const ang = hash(sectorKey) * Math.PI * 2;
      const tier = nd.tier ?? 2;
      const baseR = 110 + tier * 110;
      const jr = hash(nd.id + "r") * (130 + tier * 90);
      const ja = (hash(nd.id + "a") - 0.5) * (0.45 + tier * 0.22);
      const r = baseR + jr;
      // Spread within the plane's disc (X/Y); a thin Z jitter keeps each tier a crisp shelf.
      x = Math.cos(ang + ja) * r;
      y = Math.sin(ang + ja) * r * 0.92;
      z = pz + (hash(nd.id + "z") - 0.5) * 90;
    }

    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;
    if (Math.abs(x) > bounds) bounds = Math.abs(x);
    if (Math.abs(y) > bounds) bounds = Math.abs(y);

    const col = nd.color ? hex2rgb(nd.color) : layerColor[nd.layer] ?? [0.7, 0.7, 0.7];
    colors[i * 3] = col[0];
    colors[i * 3 + 1] = col[1];
    colors[i * 3 + 2] = col[2];

    const w = nd.weight ?? 0.3;
    sizes[i] = 3.5 + w * w * 46; // apex big, noise small
  }

  // links — one buffer, dangling dropped
  const m = g.links.length;
  const linkPos = new Float32Array(m * 6);
  const linkColors = new Float32Array(m * 6);
  let k = 0;
  for (let j = 0; j < m; j++) {
    const l = g.links[j];
    const a = index.get(l.source);
    const b = index.get(l.target);
    if (a == null || b == null) continue;
    linkPos[k * 6] = positions[a * 3];
    linkPos[k * 6 + 1] = positions[a * 3 + 1];
    linkPos[k * 6 + 2] = positions[a * 3 + 2];
    linkPos[k * 6 + 3] = positions[b * 3];
    linkPos[k * 6 + 4] = positions[b * 3 + 1];
    linkPos[k * 6 + 5] = positions[b * 3 + 2];
    const lc = l.color ? hex2rgb(l.color) : l.type === "spine" ? [0.16, 0.14, 0.2] : [0.3, 0.34, 0.42];
    for (let e = 0; e < 2; e++) {
      linkColors[k * 6 + e * 3] = lc[0];
      linkColors[k * 6 + e * 3 + 1] = lc[1];
      linkColors[k * 6 + e * 3 + 2] = lc[2];
    }
    k++;
  }

  return {
    ids,
    index,
    nodeLayer,
    positions,
    colors,
    sizes,
    linkPos: linkPos.subarray(0, k * 6),
    linkColors: linkColors.subarray(0, k * 6),
    bounds,
    count: n,
    linkCount: k,
  };
}
