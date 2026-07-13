// `booboo panel` — serve the ORGANIGRAM: the editable half of Booboo.
// The org file is a SOURCE (not a derived snapshot): the panel edits it,
// PUT /api/org validates + backs up + rewrites it, and agents boot from it
// (booboo_boot over MCP). Static serving mirrors view.ts exactly; /api/* is
// handled inline — one process, one port, no CORS.
import { createServer } from "node:http";
import { readFile, writeFile, copyFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, extname, normalize, sep } from "node:path";
import { createRequire } from "node:module";
import { spawn } from "node:child_process";

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".map": "application/json",
};

function distApp(pkg: string): string {
  const require = createRequire(import.meta.url);
  let pkgJson: string;
  try {
    pkgJson = require.resolve(`${pkg}/package.json`);
  } catch {
    throw new Error(`${pkg} is not installed — run \`npm i ${pkg}\`.`);
  }
  const dir = join(pkgJson, "..", "dist-app");
  if (!existsSync(join(dir, "index.html"))) {
    throw new Error(`${pkg}'s app isn't built — reinstall it (or \`pnpm --filter ${pkg} build\` in the repo).`);
  }
  return dir;
}

function openBrowser(url: string): void {
  const [cmd, args] =
    process.platform === "win32"
      ? ["cmd", ["/c", "start", "", url]]
      : process.platform === "darwin"
        ? ["open", [url]]
        : ["xdg-open", [url]];
  try {
    spawn(cmd as string, args as string[], { stdio: "ignore", detached: true }).unref();
  } catch {
    /* opening is best-effort */
  }
}

async function readBody(req: import("node:http").IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

export interface PanelOpts {
  org?: string;
  snapshot?: string;
  port: number;
  open: boolean;
}

export async function panel(opts: PanelOpts): Promise<void> {
  if (!opts.org) {
    console.error("usage: booboo panel --org org.booboo.json [--snapshot graph.json] [--port 8990] [--no-open]");
    process.exit(1);
  }
  if (!existsSync(opts.org)) {
    console.error(`booboo panel: org file not found — ${opts.org}`);
    process.exit(1);
  }

  const serve = await import("@booboo-brain/serve");
  const spec = await import("@booboo-brain/spec");

  let org = serve.loadOrg(opts.org);

  // Snapshot is optional context (memory/report counts in dossiers). No
  // snapshot → the org screen still fully works; counts show an honest note.
  const ix = opts.snapshot ? new serve.BoobooIndex(serve.loadSnapshot(opts.snapshot)) : null;
  if (opts.snapshot && !existsSync(opts.snapshot)) {
    console.error(`booboo panel: snapshot not found — ${opts.snapshot}`);
    process.exit(1);
  }
  // Merge the live-write journal so the Reports/Buckets tabs reflect what agents
  // have remembered/filed since the last build. The panel READS these; writes
  // come via `booboo mcp`/`serve`. Merged at load — restart the panel to pick up
  // writes made while it was open.
  if (ix && opts.snapshot) {
    const merged = serve.replayJournal(ix, serve.journalPathFor(opts.snapshot));
    if (merged) console.error(`🐾 journal · merged ${merged} live write(s)`);
  }

  const dir = distApp("@booboo-brain/panel");
  const dirPrefix = dir.endsWith(sep) ? dir : dir + sep;

  // The Graph tab embeds the real 3D viewer over the same snapshot: serve the
  // viewer's dist-app under /view/ + the raw snapshot at /snapshot.json.
  // Viewer missing/unbuilt → the tab explains itself instead of breaking.
  let viewerDir: string | null = null;
  if (opts.snapshot) {
    try {
      viewerDir = distApp("@booboo-brain/viewer");
    } catch {
      console.error("🐾 note: @booboo-brain/viewer app not found — the Graph tab will say so.");
    }
  }
  const viewerPrefix = viewerDir ? (viewerDir.endsWith(sep) ? viewerDir : viewerDir + sep) : null;
  const snapshotBuf = opts.snapshot ? await readFile(opts.snapshot) : null;

  const num = (u: URLSearchParams, k: string, d: number) => {
    const v = parseInt(u.get(k) ?? "", 10);
    return Number.isFinite(v) ? v : d;
  };
  const str = (u: URLSearchParams, k: string) => u.get(k) ?? undefined;

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const reqPath = url.pathname;

    if (reqPath.startsWith("/api/")) {
      const send = (code: number, body: unknown) => {
        res.writeHead(code, { "content-type": "application/json; charset=utf-8" });
        res.end(JSON.stringify(body));
      };
      const seg = reqPath.slice(5).split("/").filter(Boolean).map(decodeURIComponent);
      const p = url.searchParams;
      try {
        // ── the organigram ──────────────────────────────────────────────
        if (seg[0] === "org" && req.method === "GET") return send(200, org);
        if (seg[0] === "org" && req.method === "PUT") {
          // APPLY: the trust boundary. Validate first; an invalid hierarchy
          // is never written. Back up the previous file, then rewrite.
          const next = JSON.parse(await readBody(req));
          const v = spec.validateOrg(next);
          if (!v.ok) return send(400, { ok: false, errors: v.errors });
          const backup = `${opts.org}.bak`;
          await copyFile(opts.org!, backup);
          next.updated = new Date().toISOString();
          await writeFile(opts.org!, JSON.stringify(next, null, 2) + "\n", "utf8");
          org = next;
          console.error(`🐾 org applied → ${opts.org} (previous kept at ${backup})`);
          return send(200, { ok: true, backup, warnings: v.warnings });
        }
        if (seg[0] === "boot" && seg[1]) {
          const slice = spec.orgBootSlice(org, seg[1]);
          return slice ? send(200, slice) : send(404, { error: `no agent '${seg[1]}'` });
        }

        // ── snapshot context (optional) ─────────────────────────────────
        if (!ix) return send(404, { error: "no snapshot loaded — start with --snapshot to see memory/report counts" });
        if (seg[0] === "graph") return send(200, ix.meta());
        if (seg[0] === "stats") return send(200, ix.counts());
        if (seg[0] === "clusters") return send(200, { clusters: ix.clusters(str(p, "type")) });
        if (seg[0] === "search") return send(200, { nodes: ix.search(p.get("q") ?? "", num(p, "limit", 20)) });
        if (seg[0] === "nodes" && seg[1]) {
          const n = ix.node(seg[1]);
          return n ? send(200, n) : send(404, { error: `no node '${seg[1]}'` });
        }
        if (seg[0] === "nodes")
          return send(200, ix.list({ layer: str(p, "layer"), cluster: str(p, "cluster"), type: str(p, "type"), q: str(p, "q"), limit: num(p, "limit", 100), offset: num(p, "offset", 0) }));
        if (seg[0] === "neighbors" && seg[1]) return send(200, ix.neighbors(seg[1], num(p, "depth", 1), num(p, "limit", 200)));
        return send(404, { error: "unknown route" });
      } catch (e) {
        return send(500, { error: String((e as Error)?.message ?? e) });
      }
    }

    // Raw snapshot for the embedded 3D viewer.
    if (reqPath === "/snapshot.json") {
      if (!snapshotBuf) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      res.end(snapshotBuf);
      return;
    }

    // /view/* — the 3D viewer app, embedded by the Graph tab (same guard).
    if (reqPath === "/view" || reqPath.startsWith("/view/")) {
      if (!viewerDir || !viewerPrefix) { res.writeHead(404); res.end("viewer not available"); return; }
      const sub = reqPath === "/view" ? "/" : reqPath.slice(5);
      let vfile = normalize(join(viewerDir, sub === "/" ? "index.html" : sub));
      if (vfile !== viewerDir && !vfile.startsWith(viewerPrefix)) { res.writeHead(403); res.end("forbidden"); return; }
      if (!existsSync(vfile)) vfile = join(viewerDir, "index.html");
      try {
        const body = await readFile(vfile);
        res.writeHead(200, { "content-type": MIME[extname(vfile).toLowerCase()] ?? "application/octet-stream" });
        res.end(body);
      } catch {
        res.writeHead(404);
        res.end("not found");
      }
      return;
    }

    // Static files from the app dir, with a path-traversal guard (trust boundary).
    let file = normalize(join(dir, reqPath === "/" ? "index.html" : reqPath));
    if (file !== dir && !file.startsWith(dirPrefix)) {
      res.writeHead(403);
      res.end("forbidden");
      return;
    }
    if (!existsSync(file)) file = join(dir, "index.html"); // SPA fallback
    try {
      const body = await readFile(file);
      res.writeHead(200, { "content-type": MIME[extname(file).toLowerCase()] ?? "application/octet-stream" });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end("not found");
    }
  });

  server.on("error", (e: NodeJS.ErrnoException) => {
    if (e.code === "EADDRINUSE") console.error(`booboo panel: port ${opts.port} is in use — pass --port <n>.`);
    else console.error("booboo panel:", e.message);
    process.exit(1);
  });

  server.listen(opts.port, () => {
    const url = `http://localhost:${opts.port}/`;
    console.error(`🐾 booboo panel · ${org.agents.length} agents in the organigram · ${url}`);
    if (opts.open) openBrowser(url);
  });
}
