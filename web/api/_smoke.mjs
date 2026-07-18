/* Local smoke for the hosted ASK endpoint. Run from the assembled deploy root:
 *   node scripts/build-web.mjs && cd web/dist && npm install && node api/_smoke.mjs
 * Phase 1 drives every registered tool handler directly (unit).
 * Phase 2 drives the real exported function with JSON-RPC over fetch Requests
 * (initialize → tools/list → tools/call), i.e. exactly what claude.ai will do.
 * Exits non-zero on the first failed assertion. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { BoobooIndex } from "./_index.mjs";
import { registerTools } from "./_tools.mjs";

const read = (f) => JSON.parse(readFileSync(new URL(`./_data/${f}`, import.meta.url), "utf8"));
const graph = read("pemberton.booboo.json");
const org = read("org.pemberton.booboo.json");
const ix = new BoobooIndex(graph);

const unwrap = (r) => JSON.parse(r.content[0].text);

// ── Phase 1: every tool handler, executed directly ───────────────────────────
const tools = new Map();
registerTools({ tool: (name, _desc, _schema, fn) => tools.set(name, fn) }, ix, org);
assert.deepEqual(
  [...tools.keys()].sort(),
  ["booboo_boot", "booboo_neighbors", "booboo_node", "booboo_org", "booboo_path", "booboo_search", "booboo_stats"],
  "expected exactly the 7 read-only tools",
);

const stats = unwrap(await tools.get("booboo_stats")({}));
assert.equal(stats.nodes, 2414, "stats.nodes");
assert.equal(stats.links, 397, "stats.links");
assert.equal(stats.byLayer.ledger, 2292, "stats.byLayer.ledger");
console.log(`✓ booboo_stats       nodes=${stats.nodes} links=${stats.links} byLayer=${JSON.stringify(stats.byLayer)}`);

const found = unwrap(await tools.get("booboo_search")({ query: "housekeeping" }));
assert.ok(found.length > 0 && found.length <= 20, "search returns 1..20 results");
assert.ok(found[0].id.toLowerCase().includes("housekeeping") || found[0].label.toLowerCase().includes("housekeeping"), "top hit matches");
console.log(`✓ booboo_search      "housekeeping" → ${found.length} hits, top: ${found[0].id}`);

const root = unwrap(await tools.get("booboo_node")({ id: "standard" }));
assert.equal(root?.id, "standard", "root node fetch");
console.log(`✓ booboo_node        standard → "${root.label}" (layer ${root.layer})`);
assert.equal(unwrap(await tools.get("booboo_node")({ id: "no-such-node" })), null, "unknown node → null");

const hood = unwrap(await tools.get("booboo_neighbors")({ id: "standard" }));
assert.equal(hood.center.id, "standard");
assert.ok(hood.nodes.length > 0 && hood.links.length > 0, "root has neighbours");
console.log(`✓ booboo_neighbors   standard depth=1 → ${hood.nodes.length} nodes, ${hood.links.length} links`);

const chain = unwrap(await tools.get("booboo_path")({ from: "agent:gm", to: "bucket:housekeeping" }));
assert.deepEqual(chain.map((n) => n.id), ["agent:gm", "agent:housekeeping", "bucket:housekeeping"], "shortest path");
console.log(`✓ booboo_path        agent:gm → bucket:housekeeping = ${chain.map((n) => n.id).join(" → ")}`);
assert.equal(unwrap(await tools.get("booboo_path")({ from: "standard", to: "no-such-node" })), null, "unreachable → null");

const boot = unwrap(await tools.get("booboo_boot")({ agent: "housekeeping" }));
assert.deepEqual(boot.rules, ["rules/HOUSE_STANDARD.md", "rules/sop/HOUSEKEEPING.md"], "rules inherited in boot order (ancestors first)");
assert.deepEqual(boot.chain.map((a) => a.id), ["gm", "housekeeping"], "authority chain root→agent");
assert.deepEqual(boot.buckets, ["house", "executive", "housekeeping"], "buckets own+inherited");
assert.ok(boot.children.length > 0, "housekeeping has children");
console.log(`✓ booboo_boot        housekeeping → rules=${JSON.stringify(boot.rules)} children=${boot.children.length}`);

const miss = unwrap(await tools.get("booboo_boot")({ agent: "nobody" }));
assert.ok(miss.error?.includes("no agent 'nobody'") && miss.agents.length === 62, "unknown agent → error + roster");
console.log(`✓ booboo_boot        unknown agent → error + ${miss.agents.length}-agent roster`);

const fullOrg = unwrap(await tools.get("booboo_org")({}));
assert.equal(fullOrg.root, "gm");
assert.equal(fullOrg.agents.length, 62);
console.log(`✓ booboo_org         root=${fullOrg.root} agents=${fullOrg.agents.length}`);

// ── Phase 2: the real function, spoken to like claude.ai does ────────────────
const t0 = performance.now();
const { GET, POST, DELETE } = await import("./mcp.mjs");
console.log(`✓ import ./mcp.mjs   (module-scope snapshot load + index) in ${Math.round(performance.now() - t0)}ms`);

const URL_ = "https://booboo-black.vercel.app/api/mcp";
const HDRS = { "content-type": "application/json", accept: "application/json, text/event-stream", "mcp-protocol-version": "2025-06-18" };
let id = 0;
const rpc = async (method, params) => {
  const res = await POST(new Request(URL_, { method: "POST", headers: HDRS, body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method, params }) }));
  assert.notEqual(res.status, 401, `${method} must never 401`);
  assert.equal(res.status, 200, `${method} → HTTP ${res.status}`);
  const body = await res.json();
  assert.ok(!body.error, `${method} rpc error: ${JSON.stringify(body.error)}`);
  return body.result;
};

const init = await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "smoke", version: "0" } });
assert.equal(init.serverInfo.name, "booboo", "serverInfo.name");
console.log(`✓ HTTP initialize    serverInfo=${init.serverInfo.name}@${init.serverInfo.version} protocol=${init.protocolVersion}`);

const note = await POST(new Request(URL_, { method: "POST", headers: HDRS, body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) }));
assert.equal(note.status, 202, "notification accepted");
console.log(`✓ HTTP notification  notifications/initialized → ${note.status}`);

const listed = await rpc("tools/list", {});
assert.equal(listed.tools.length, 7, "7 tools over HTTP");
console.log(`✓ HTTP tools/list    ${listed.tools.map((t) => t.name).join(", ")}`);

const httpStats = JSON.parse((await rpc("tools/call", { name: "booboo_stats", arguments: {} })).content[0].text);
assert.equal(httpStats.nodes, 2414, "stats over HTTP");
const httpBoot = JSON.parse((await rpc("tools/call", { name: "booboo_boot", arguments: { agent: "housekeeping" } })).content[0].text);
assert.deepEqual(httpBoot.rules, ["rules/HOUSE_STANDARD.md", "rules/sop/HOUSEKEEPING.md"], "boot over HTTP");
console.log(`✓ HTTP tools/call    booboo_stats nodes=${httpStats.nodes} · booboo_boot rules ok`);

// never-401: the authless trap — every non-POST/bad request must be 4xx-not-401
for (const [label, req] of [
  ["GET /api/mcp", () => GET(new Request(URL_, { method: "GET", headers: HDRS }))],
  ["DELETE /api/mcp", () => DELETE(new Request(URL_, { method: "DELETE", headers: HDRS }))],
  ["POST bad body", () => POST(new Request(URL_, { method: "POST", headers: HDRS, body: "not json" }))],
]) {
  const res = await req();
  assert.notEqual(res.status, 401, `${label} must never 401`);
  console.log(`✓ never-401          ${label} → ${res.status}`);
}

console.log("\nSMOKE PASS — hosted ASK endpoint answers identically to the local CLI tools.");
