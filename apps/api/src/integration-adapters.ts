export type IntegrationProtocol = "REST" | "SOAP" | "SFTP" | "WebSocket" | string;

export type IntegrationAdapterInput = {
  code: string;
  protocol: IntegrationProtocol;
  endpoint: string | null;
  direction: string | null;
  installationCode: string;
};

export type IntegrationAdapterResult = {
  ok: boolean;
  mode: "SIMULATED" | "EXTERNAL";
  processed: number;
  latencyMs: number;
  error?: string;
};

const executionMode = () => String(process.env.INTEGRATION_EXECUTION_MODE ?? "SIMULATED").toUpperCase() === "EXTERNAL" ? "EXTERNAL" : "SIMULATED";
const timeoutMs = () => Math.min(30000, Math.max(1000, Number(process.env.INTEGRATION_TIMEOUT_MS ?? 10000)));

const validateEndpoint = (endpoint: string | null) => {
  if (!endpoint) return "La integración no tiene endpoint configurado";
  try {
    const url = new URL(endpoint);
    if (!['http:', 'https:'].includes(url.protocol)) return "El endpoint debe usar HTTP o HTTPS";
    return null;
  } catch {
    return "El endpoint de la integración no es válido";
  }
};

const externalRequest = async (input: IntegrationAdapterInput): Promise<IntegrationAdapterResult> => {
  const endpointError = validateEndpoint(input.endpoint);
  if (endpointError) return { ok: false, mode: "EXTERNAL", processed: 0, latencyMs: 0, error: endpointError };
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs());
  try {
    const isSoap = input.protocol.toUpperCase() === "SOAP";
    const outbound = String(input.direction ?? "").toLowerCase().includes("outbound") || String(input.direction ?? "").toLowerCase().includes("bidireccional");
    const body = isSoap
      ? `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><sga:ping xmlns:sga="urn:almacensga"><sga:integration>${input.code}</sga:integration><sga:installation>${input.installationCode}</sga:installation></sga:ping></soap:Body></soap:Envelope>`
      : JSON.stringify({ integration: input.code, installation: input.installationCode, triggeredAt: new Date().toISOString() });
    const response = await fetch(input.endpoint as string, {
      method: isSoap || outbound ? "POST" : "GET",
      headers: isSoap ? { "Content-Type": "text/xml; charset=utf-8", SOAPAction: "urn:almacensga:ping" } : { Accept: "application/json", "Content-Type": "application/json" },
      body: isSoap || outbound ? body : undefined,
      signal: controller.signal,
    });
    if (!response.ok) return { ok: false, mode: "EXTERNAL", processed: 0, latencyMs: Date.now() - startedAt, error: `El endpoint respondió HTTP ${response.status}` };
    return { ok: true, mode: "EXTERNAL", processed: 1, latencyMs: Date.now() - startedAt };
  } catch (error) {
    const message = error instanceof Error && error.name === "AbortError" ? `Timeout de integración tras ${timeoutMs()} ms` : error instanceof Error ? error.message : "Error desconocido del adaptador";
    return { ok: false, mode: "EXTERNAL", processed: 0, latencyMs: Date.now() - startedAt, error: message.slice(0, 500) };
  } finally {
    clearTimeout(timeout);
  }
};

export const executeIntegrationAdapter = async (input: IntegrationAdapterInput): Promise<IntegrationAdapterResult> => {
  if (executionMode() !== "EXTERNAL") return { ok: true, mode: "SIMULATED", processed: 1, latencyMs: 0 };
  if (!['REST', 'SOAP'].includes(input.protocol.toUpperCase())) return { ok: false, mode: "EXTERNAL", processed: 0, latencyMs: 0, error: `No existe adaptador externo para el protocolo ${input.protocol}` };
  return externalRequest(input);
};
