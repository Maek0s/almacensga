import { createServer } from "node:http";
import { describe, expect, it } from "vitest";
import { executeIntegrationAdapter } from "./integration-adapters.js";

const input = { code: "INT-TEST", protocol: "REST", endpoint: "https://example.invalid/api", direction: "Outbound", installationCode: "MADRID01" };

const withExternalMode = async <T>(callback: () => Promise<T>) => {
  const previous = process.env.INTEGRATION_EXECUTION_MODE;
  process.env.INTEGRATION_EXECUTION_MODE = "EXTERNAL";
  try {
    return await callback();
  } finally {
    if (previous === undefined) delete process.env.INTEGRATION_EXECUTION_MODE; else process.env.INTEGRATION_EXECUTION_MODE = previous;
  }
};

describe("adaptadores de integraciones", () => {
  it("usa simulación segura por defecto", async () => {
    const previous = process.env.INTEGRATION_EXECUTION_MODE;
    delete process.env.INTEGRATION_EXECUTION_MODE;
    const result = await executeIntegrationAdapter(input);
    if (previous === undefined) delete process.env.INTEGRATION_EXECUTION_MODE; else process.env.INTEGRATION_EXECUTION_MODE = previous;
    expect(result).toMatchObject({ ok: true, mode: "SIMULATED", processed: 1 });
  });

  it("rechaza protocolos sin adaptador cuando se solicita modo externo", async () => {
    const result = await withExternalMode(() => executeIntegrationAdapter({ ...input, protocol: "SFTP" }));
    expect(result).toMatchObject({ ok: false, mode: "EXTERNAL", processed: 0 });
  });

  it("valida el endpoint antes de intentar una llamada externa", async () => {
    const result = await withExternalMode(() => executeIntegrationAdapter({ ...input, endpoint: "ftp://not-supported.test/integration" }));
    expect(result.error).toContain("HTTP");
  });

  it("ejecuta una llamada REST externa con timeout y resultado medido", async () => {
    const requests: Array<{ method: string; body: string }> = [];
    const server = createServer((request, response) => {
      const chunks: Buffer[] = [];
      request.on("data", (chunk: Buffer) => chunks.push(chunk));
      request.on("end", () => {
        requests.push({ method: request.method ?? "", body: Buffer.concat(chunks).toString("utf8") });
        response.writeHead(200, { "content-type": "application/json" });
        response.end(JSON.stringify({ ok: true }));
      });
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;
    try {
      const result = await withExternalMode(() => executeIntegrationAdapter({ ...input, endpoint: `http://127.0.0.1:${port}/integration` }));
      expect(result).toMatchObject({ ok: true, mode: "EXTERNAL", processed: 1 });
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
      expect(requests[0]?.method).toBe("POST");
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });

  it("envía un envelope SOAP cuando se selecciona el protocolo SOAP", async () => {
    let body = "";
    const server = createServer((request, response) => {
      const chunks: Buffer[] = [];
      request.on("data", (chunk: Buffer) => chunks.push(chunk));
      request.on("end", () => {
        body = Buffer.concat(chunks).toString("utf8");
        response.writeHead(200);
        response.end("<ok/>");
      });
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;
    try {
      const result = await withExternalMode(() => executeIntegrationAdapter({ ...input, protocol: "SOAP", direction: "Inbound", endpoint: `http://127.0.0.1:${port}/soap` }));
      expect(result.ok).toBe(true);
      expect(body).toContain("soap:Envelope");
      expect(body).toContain("INT-TEST");
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });
});
