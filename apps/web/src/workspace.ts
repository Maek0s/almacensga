import { apiUrl } from "./api";

export type WorkspaceResource = "stock" | "receipts" | "picking" | "shipments" | "installations" | "locations" | "movements" | "inventory" | "queries" | "users" | "products" | "replenishment" | "suppliers" | "customers" | "integrations" | "audit" | "roles";

export type WorkspaceRow = Record<string, string | number | null> & { id: string };
export type WorkspaceRecordInput = Record<string, string | number | null | string[]>;

export type WorkspaceResponse = {
  resource: WorkspaceResource;
  items: WorkspaceRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  generatedRows: number;
  availableStatuses: string[];
};

export type WorkspaceQuery = {
  search?: string;
  status?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDir?: "asc" | "desc";
};

export type RouteMetric = { count: number; errors: number; totalMs: number; averageMs: number; maxMs: number };
export type SlowRequestMetric = { method: string; path: string; statusCode: number; durationMs: number; completedAt: string; requestId: string };
export type ServerMetrics = {
  generatedAt: string;
  uptimeSeconds: number;
  memory: { rss: number; heapTotal: number; heapUsed: number; external: number };
  database: { status: "connected" | "unavailable"; latencyMs: number | null };
  slowRequestThresholdMs: number;
  slowRequests: SlowRequestMetric[];
  routes: Record<string, RouteMetric>;
};

export type SupportIncidentReport = {
  code: string;
  title: string;
  message: string;
  technicalMessage?: string;
  hint: string;
  route: string;
  resource?: string;
  action?: string;
  userDescription?: string;
  screenshotDataUrl?: string;
  screenshotName?: string;
};

export type InstallationInput = {
  code: string;
  name: string;
  city: string;
  timezone: string;
  environment: string;
  version: string;
  status: string;
  manager: string;
};

export type PageActionKind = "defined" | "custom";
export type PageActionType = "operation" | "export" | "navigation" | "custom";
export type PageActionVariant = "primary" | "secondary" | "danger";
export type PageAction = {
  id: string;
  label: string;
  kind: PageActionKind;
  actionType: PageActionType;
  enabled: boolean;
  variant: PageActionVariant;
  roleKeys?: string[];
  targetResource?: WorkspaceResource;
};

export type QueryColumnType = "text" | "number" | "percentage" | "currency" | "date" | "status";
export type QueryConditionOperator = "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "contains";

export type QueryConfigurationCondition = {
  operator: QueryConditionOperator;
  value: string | number;
  background: string;
  textColor: string;
  label?: string;
};

export type QueryConfigurationColumn = {
  key: string;
  label: string;
  visible: boolean;
  type: QueryColumnType;
  decimals?: number;
  suffix?: string;
  background?: string;
  textColor?: string;
  badge?: boolean;
  conditions?: QueryConfigurationCondition[];
};

export type QueryConfigurationFilter = {
  key: string;
  label: string;
  type: string;
};

export type QueryConfiguration = {
  id: string;
  resource: WorkspaceResource;
  installationId: string;
  installation: string;
  name: string;
  description: string | null;
  sqlText: string;
  columns: QueryConfigurationColumn[];
  filters: QueryConfigurationFilter[];
  parameters: string[];
  defaultSort: string | null;
  actions: string[];
  allowedRoles: string[];
  status: string;
  version: number;
  publishedAt: string | null;
  updatedByName: string | null;
  updatedAt: string;
};

export type QueryConfigurationInput = Pick<QueryConfiguration, "name" | "description" | "sqlText" | "columns" | "filters" | "parameters" | "defaultSort" | "actions" | "allowedRoles">;

export type StockMovementInput = {
  sku: string;
  lot?: string;
  type: "IN" | "OUT";
  quantity: number;
  reason: string;
  origin?: string;
  destination?: string;
  sourceDocument?: string;
};

export type PageActionConfiguration = {
  id: string | null;
  resource: WorkspaceResource;
  installationId: string;
  actions: PageAction[];
  version: number;
  updatedByName: string | null;
  updatedAt: string | null;
};

export async function fetchWorkspace(resource: WorkspaceResource, token: string, query: WorkspaceQuery = {}) {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== "") params.set(key, String(value));
  });

  const response = await fetch(apiUrl(`/api/workspace/${resource}?${params.toString()}`), {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = (await response.json()) as WorkspaceResponse & { message?: string };
  if (!response.ok) throw new Error(body.message ?? "No se pudo cargar el módulo");
  return body;
}

export async function fetchDeveloperMetrics(token: string) {
  const response = await fetch(apiUrl("/api/metrics"), { headers: { Authorization: `Bearer ${token}` } });
  const body = (await response.json()) as ServerMetrics & { message?: string };
  if (!response.ok) throw new Error(body.message ?? "No se pudieron cargar las métricas del servidor");
  return body;
}

export async function saveInstallation(token: string, id: string, input: InstallationInput) {
  const isNew = id === "new";
  const response = await fetch(apiUrl(isNew ? "/api/installations" : `/api/installations/${encodeURIComponent(id)}`), {
    method: isNew ? "POST" : "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const body = (await response.json()) as WorkspaceRow & { message?: string };
  if (!response.ok) throw new Error(body.message ?? "No se pudo guardar la instalación");
  return body;
}

export async function createWorkspaceRecord(resource: WorkspaceResource, token: string, payload: WorkspaceRecordInput) {
  const response = await fetch(apiUrl(`/api/workspace/${resource}`), {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ payload }),
  });
  const body = (await response.json()) as WorkspaceRow & { message?: string };
  if (!response.ok) throw new Error(body.message ?? "No se pudo crear el registro");
  return body;
}

export async function updateWorkspaceRecord(resource: WorkspaceResource, token: string, id: string, payload: WorkspaceRecordInput) {
  const response = await fetch(apiUrl(`/api/workspace/${resource}/${encodeURIComponent(id)}`), {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ payload }),
  });
  const body = (await response.json()) as WorkspaceRow & { message?: string };
  if (!response.ok) throw new Error(body.message ?? "No se pudo actualizar el registro");
  return body;
}

export async function executeSqlTool(token: string, resource: WorkspaceResource, sqlText: string) {
  const response = await fetch(apiUrl("/api/tools/sql/execute"), { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ resource, sqlText }) });
  const body = (await response.json()) as { message?: string; rowCount?: number; durationMs?: number; rows?: WorkspaceRow[] };
  if (!response.ok) throw new Error(body.message ?? "No se pudo ejecutar SQL Helper");
  return body;
}

export async function executeLoopTool(token: string, resource: WorkspaceResource, ids: string[], status: string) {
  const response = await fetch(apiUrl("/api/tools/loop/execute"), { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ resource, ids, status }) });
  const body = (await response.json()) as { message?: string; updated?: number };
  if (!response.ok) throw new Error(body.message ?? "No se pudo ejecutar Loop Helper");
  return body;
}

export async function publishUpdater(token: string, version: string, environment: string) {
  const response = await fetch(apiUrl("/api/tools/updater/publish"), { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ version, environment }) });
  const body = (await response.json()) as { message?: string; version?: string };
  if (!response.ok) throw new Error(body.message ?? "No se pudo publicar la actualización");
  return body;
}

export async function importXmlTool(token: string, xml: string) {
  const response = await fetch(apiUrl("/api/tools/xml/import"), { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ xml }) });
  const body = (await response.json()) as { message?: string; lineCount?: number };
  if (!response.ok) throw new Error(body.message ?? "No se pudo importar el XML");
  return body;
}

export async function runIntegration(token: string, id: string) {
  const response = await fetch(apiUrl(`/api/integrations/${encodeURIComponent(id)}/run`), { method: "POST", headers: { Authorization: `Bearer ${token}` } });
  const body = (await response.json()) as WorkspaceRow & { message?: string };
  if (!response.ok) throw new Error(body.message ?? "No se pudo ejecutar la integración");
  return body;
}

export async function retryIntegrations(token: string) {
  const response = await fetch(apiUrl("/api/integrations/retry"), { method: "POST", headers: { Authorization: `Bearer ${token}` } });
  const body = (await response.json()) as { message?: string; updated?: number };
  if (!response.ok) throw new Error(body.message ?? "No se pudieron reintentar las integraciones");
  return body;
}

export async function reportSupportIncident(token: string, report: SupportIncidentReport) {
  const response = await fetch(apiUrl("/api/support/incidents"), {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(report),
  });
  const body = (await response.json()) as { message?: string; reference: string; delivery?: "LOCAL" | "EXTERNAL" };
  if (!response.ok) throw new Error(body.message ?? "No se pudo enviar la incidencia a soporte");
  return body;
}

const parseQueryConfigurationResponse = async (response: Response) => {
  const body = (await response.json()) as QueryConfiguration & { message?: string };
  if (!response.ok) throw new Error(body.message ?? "No se pudo cargar la configuración de la consulta");
  return body;
};

export async function fetchQueryConfiguration(resource: WorkspaceResource, token: string) {
  return parseQueryConfigurationResponse(await fetch(apiUrl(`/api/query-configurations/${resource}`), { headers: { Authorization: `Bearer ${token}` } }));
}

export async function saveQueryConfiguration(resource: WorkspaceResource, token: string, input: QueryConfigurationInput) {
  return parseQueryConfigurationResponse(await fetch(apiUrl(`/api/query-configurations/${resource}`), {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(input),
  }));
}

export async function publishQueryConfiguration(resource: WorkspaceResource, token: string) {
  return parseQueryConfigurationResponse(await fetch(apiUrl(`/api/query-configurations/${resource}/publish`), {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  }));
}

export async function createStockMovement(token: string, input: StockMovementInput) {
  const response = await fetch(apiUrl("/api/stock/movements"), {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const body = (await response.json()) as { message?: string; stock?: WorkspaceRow };
  if (!response.ok) throw new Error(body.message ?? "No se pudo registrar el movimiento");
  return body;
}

export async function fetchPageActions(resource: WorkspaceResource, token: string) {
  const response = await fetch(apiUrl(`/api/page-actions/${resource}`), { headers: { Authorization: `Bearer ${token}` } });
  const body = (await response.json()) as PageActionConfiguration & { message?: string };
  if (!response.ok) throw new Error(body.message ?? "No se pudieron cargar las acciones de la página");
  return body;
}

export async function savePageActions(resource: WorkspaceResource, token: string, actions: PageAction[]) {
  const response = await fetch(apiUrl(`/api/page-actions/${resource}`), {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ actions }),
  });
  const body = (await response.json()) as PageActionConfiguration & { message?: string };
  if (!response.ok) throw new Error(body.message ?? "No se pudieron guardar las acciones");
  return body;
}

export const canManageConfiguration = (roleKey: string) => roleKey === "DEVELOPER" || roleKey === "PRODUCT_OWNER";
