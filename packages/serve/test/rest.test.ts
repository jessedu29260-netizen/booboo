import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { createRestServer } from "../src/rest.js";
import { BoobooIndex } from "../src/graph.js";
import type { BoobooGraph } from "@booboo-brain/spec";

const g: BoobooGraph = {
  booboo: "1.0",
  meta: { root: "core", layers: [{ name: "a" }] },
  nodes: [{ id: "core", type: "root", layer: "a", label: "Core", weight: 1 }],
  links: [],
};

let server: Server;
let base: string;
const originalToken = process.env.BOOBOO_TOKEN;

async function listen(): Promise<void> {
  server = createRestServer(new BoobooIndex(g));
  await new Promise<void>((resolve) => server.listen(0, resolve));
  base = `http://localhost:${(server.address() as AddressInfo).port}`;
}

afterEach(async () => {
  process.env.BOOBOO_TOKEN = originalToken;
  await new Promise((resolve) => server.close(resolve));
});

describe("createRestServer auth", () => {
  it("is open when BOOBOO_TOKEN is unset", async () => {
    delete process.env.BOOBOO_TOKEN;
    await listen();
    const res = await fetch(`${base}/graph`);
    expect(res.status).toBe(200);
  });

  it("rejects requests missing/wrong Authorization when BOOBOO_TOKEN is set", async () => {
    process.env.BOOBOO_TOKEN = "secret-token";
    await listen();
    const noAuth = await fetch(`${base}/graph`);
    expect(noAuth.status).toBe(401);
    const wrongAuth = await fetch(`${base}/graph`, { headers: { authorization: "Bearer nope" } });
    expect(wrongAuth.status).toBe(401);
  });

  it("accepts the correct bearer token", async () => {
    process.env.BOOBOO_TOKEN = "secret-token";
    await listen();
    const res = await fetch(`${base}/graph`, { headers: { authorization: "Bearer secret-token" } });
    expect(res.status).toBe(200);
  });
});
