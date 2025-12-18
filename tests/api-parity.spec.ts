import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServer } from "../server/index";
import type { AddressInfo } from "net";
import appWorker from "../worker/src/index";

let baseUrl = "";
let server: any;

beforeAll(async () => {
  const app = createServer();
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", () => resolve()));
  const addr = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${addr.port}`;
});

afterAll(async () => {
  if (server) {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

describe("API parity: worker vs express", () => {
  it("GET /api/ping returns identical response", async () => {
    const resExpress = await fetch(`${baseUrl}/api/ping`);
    const bodyExpress = await resExpress.json();

    const resWorker = await appWorker.request("/api/ping");
    const bodyWorker = await resWorker.json();

    expect(resExpress.status).toBe(resWorker.status);
    expect(resExpress.headers.get("content-type")).toContain("application/json");
    expect(resWorker.headers.get("content-type")).toContain("application/json");
    expect(bodyWorker).toEqual(bodyExpress);
  });

  it("POST /api/momo/ipn returns identical response", async () => {
    const resExpress = await fetch(`${baseUrl}/api/momo/ipn`, { method: "POST" });
    const bodyExpress = await resExpress.json();

    const resWorker = await appWorker.request("/api/momo/ipn", { method: "POST" });
    const bodyWorker = await resWorker.json();

    expect(resExpress.status).toBe(resWorker.status);
    expect(resExpress.headers.get("content-type")).toContain("application/json");
    expect(resWorker.headers.get("content-type")).toContain("application/json");
    expect(bodyWorker).toEqual(bodyExpress);
  });

  it("POST /api/vnpay/ipn returns identical response", async () => {
    const resExpress = await fetch(`${baseUrl}/api/vnpay/ipn`, { method: "POST" });
    const bodyExpress = await resExpress.json();

    const resWorker = await appWorker.request("/api/vnpay/ipn", { method: "POST" });
    const bodyWorker = await resWorker.json();

    expect(resExpress.status).toBe(resWorker.status);
    expect(resExpress.headers.get("content-type")).toContain("application/json");
    expect(resWorker.headers.get("content-type")).toContain("application/json");
    expect(bodyWorker).toEqual(bodyExpress);
  });
});

