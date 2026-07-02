#!/usr/bin/env bash
# Runs INSIDE a clean node:20 container — the first-time user's journey, asserted.
# The container has never seen the monorepo; everything installs from $REGISTRY.
set -euo pipefail

REGISTRY="${REGISTRY:-http://booboo-registry:4873}"
export npm_config_registry="$REGISTRY"
export CI=1

fail() { echo "✗ FAIL: $1" >&2; exit 1; }
pass() { echo "✓ $1"; }
t0=$(date +%s)
step() { echo; echo "── [$(( $(date +%s) - t0 ))s] $1"; }

step "scaffold: npx create-booboo my-brain"
cd /tmp
npx --yes create-booboo my-brain || fail "create-booboo scaffold errored"
[ -f my-brain/package.json ] || fail "scaffold produced no package.json"
[ -f my-brain/booboo.config.yaml ] || fail "scaffold produced no booboo.config.yaml"
pass "scaffolded"
cd my-brain

step "install from registry"
npm install --no-audit --no-fund || fail "npm install errored"
node -e "import('@booboo-brain/spec').then(()=>process.exit(0),()=>process.exit(1))" || fail "@booboo-brain/spec not importable"
pass "installed"

step "build: config → brain.json"
npm run build || fail "booboo build errored"
SNAP=$(ls *.booboo.json brain.json 2>/dev/null | head -1)
[ -n "$SNAP" ] || fail "no snapshot produced"
NODES=$(node -e "const s=require('./$SNAP'); console.log(s.nodes.length)")
[ "$NODES" -gt 0 ] || fail "snapshot has 0 nodes"
pass "built $SNAP ($NODES nodes)"

step "serve: REST endpoints"
(npm run serve >/tmp/serve.log 2>&1 &)
for i in $(seq 1 20); do curl -sf http://localhost:8787/stats >/dev/null 2>&1 && break; sleep 1; done
curl -sf http://localhost:8787/stats | grep -q nodes || { cat /tmp/serve.log; fail "/stats not answering"; }
curl -sf http://localhost:8787/graph -o /dev/null || fail "/graph not answering"
curl -sf "http://localhost:8787/search?q=a" -o /dev/null || fail "/search not answering"
pass "REST live (/stats /graph /search)"

step "view: 3D app served + redirect"
(npx booboo view --snapshot "$SNAP" --port 8989 --no-open >/tmp/view.log 2>&1 &)
for i in $(seq 1 20); do curl -s -o /dev/null http://localhost:8989/snapshot.json 2>/dev/null && break; sleep 1; done
CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8989/)
[ "$CODE" = "302" ] || { cat /tmp/view.log; fail "bare / expected 302, got $CODE"; }
curl -sf "http://localhost:8989/?file=/snapshot.json" | grep -qi "<html" || fail "viewer app html not served"
curl -sf http://localhost:8989/snapshot.json | grep -q nodes || fail "snapshot.json not served"
pass "viewer app live (302 redirect + app + snapshot)"

step "mcp: stdio handshake"
node - <<'EOF' || fail "MCP handshake failed"
const { spawn } = require("child_process");
const p = spawn("npx", ["booboo", "mcp", "--snapshot", process.env.SNAP || require("fs").readdirSync(".").find(f=>f.endsWith(".booboo.json"))||"brain.json"], { cwd: process.cwd() });
let buf = "", done = false;
const kill = (code, msg) => { if (done) return; done = true; console.log(msg); p.kill(); process.exit(code); };
p.stdout.on("data", d => {
  buf += d.toString();
  for (const line of buf.split("\n")) {
    if (!line.trim()) continue;
    try { const m = JSON.parse(line);
      if (m.id === 1 && m.result && m.result.serverInfo) kill(0, "mcp initialize ok: " + m.result.serverInfo.name);
    } catch {}
  }
});
p.stderr.on("data", () => {});
p.on("exit", c => kill(1, "mcp exited early (code " + c + ")"));
setTimeout(() => kill(1, "mcp initialize timed out (15s)"), 15000);
p.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "stress", version: "0" } } }) + "\n");
EOF
pass "MCP answers initialize"

echo
echo "════════════════════════════════════════"
echo "  CLEAN-INSTALL GATE: ALL GREEN in $(( $(date +%s) - t0 ))s"
echo "════════════════════════════════════════"
