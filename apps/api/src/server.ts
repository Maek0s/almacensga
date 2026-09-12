import { createHash, randomBytes } from "node:crypto";
import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import { compare, hash } from "bcryptjs";
import { Prisma, PrismaClient } from "@prisma/client";
import { getWorkspaceRows, type WorkspaceResource } from "./warehouse-data.js";
import { executeIntegrationAdapter } from "./integration-adapters.js";
import { createWorkspaceRepository } from "./workspace-repository.js";

const app = express();
const prisma = new PrismaClient();
const workspaceRepository = createWorkspaceRepository(prisma);
const port = Number(process.env.PORT ?? 3000);
const supportWebhookUrl = process.env.SUPPORT_WEBHOOK_URL?.trim() || "";
const sessionDurationMs = 8 * 60 * 60 * 1000;
const loginAttemptWindowMs = Math.max(60_000, Number(process.env.LOGIN_RATE_LIMIT_WINDOW_MS ?? 15 * 60 * 1000));
const loginAttemptLimit = Math.max(3, Number(process.env.LOGIN_RATE_LIMIT_MAX ?? 8));
const requestMetrics = new Map<string, { count: number; errors: number; totalMs: number; maxMs: number }>();
const slowRequestThresholdMs = Math.max(250, Number(process.env.SLOW_REQUEST_THRESHOLD_MS ?? 1000));
type SlowRequestMetric = { method: string; path: string; statusCode: number; durationMs: number; completedAt: string; requestId: string };
const slowRequests: SlowRequestMetric[] = [];

app.use(cors({ origin: true }));
app.use(express.json({ limit: "1mb" }));
app.use((request, response, next) => {
  const startedAt = Date.now();
  const requestId = request.header("x-request-id")?.slice(0, 120) || randomBytes(8).toString("hex");
  response.setHeader("X-Request-ID", requestId);
  response.on("finish", () => {
    const route = String(request.route?.path ?? request.path);
    const key = `${request.method} ${route}`;
    const durationMs = Date.now() - startedAt;
    const previous = requestMetrics.get(key) ?? { count: 0, errors: 0, totalMs: 0, maxMs: 0 };
    requestMetrics.set(key, { count: previous.count + 1, errors: previous.errors + (response.statusCode >= 500 ? 1 : 0), totalMs: previous.totalMs + durationMs, maxMs: Math.max(previous.maxMs, durationMs) });
    if (durationMs >= slowRequestThresholdMs) {
      slowRequests.unshift({ method: request.method, path: route, statusCode: response.statusCode, durationMs, completedAt: new Date().toISOString(), requestId });
      if (slowRequests.length > 50) slowRequests.length = 50;
    }
  });
  next();
});

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

const sessionInclude = {
  user: { include: { client: true, assignments: { include: { role: { include: { permissions: { include: { permission: true } } } } } } } },
  installation: { include: { warehouses: true } },
} as const;

type SessionContext = {
  sessionId: string;
  token: string;
  user: { id: string; username: string; displayName: string; email: string };
  client: { id: string; code: string; name: string; logoKey: string | null };
  installation: { id: string; code: string; name: string; environment: string; warehouseId: string | null };
  role: { key: string; name: string; permissions: string[] };
};

type SessionRecord = Awaited<ReturnType<typeof prisma.session.findUniqueOrThrow>> & {
  user: { id: string; username: string; displayName: string; email: string; client: { id: string; code: string; name: string; logoKey: string | null }; assignments: Array<{ installationId: string; role: { key: string; name: string; permissions: Array<{ permission: { key: string } }> } }> };
  installation: { id: string; code: string; name: string; environment: string; warehouses: Array<{ id: string }> };
};

const serializeSession = (session: SessionRecord, token: string): SessionContext => ({
  sessionId: session.id,
  token,
  user: { id: session.user.id, username: session.user.username, displayName: session.user.displayName, email: session.user.email },
  client: { id: session.user.client.id, code: session.user.client.code, name: session.user.client.name, logoKey: session.user.client.logoKey },
  installation: { id: session.installation.id, code: session.installation.code, name: session.installation.name, environment: session.installation.environment, warehouseId: session.installation.warehouses[0]?.id ?? null },
  role: (() => {
    const role = session.user.assignments.find((assignment) => assignment.installationId === session.installation.id)?.role;
    return role ? { key: role.key, name: role.name, permissions: role.permissions.map(({ permission }) => permission.key) } : { key: "WAREHOUSE_MANAGER", name: "Gestor de almacén", permissions: ["workspace.read", "workspace.operate", "tools.xml.import", "tools.loop.execute", "audit.read"] };
  })(),
});

const getBearerToken = (request: Request) => {
  const [scheme, token] = (request.headers.authorization ?? "").split(" ");
  return scheme === "Bearer" && token ? token : null;
};

const loginRateLimited = async (key: string) => {
  const bucket = await prisma.rateLimitBucket.findUnique({ where: { key } });
  if (!bucket) return false;
  const now = new Date();
  if (bucket.firstAt.getTime() + loginAttemptWindowMs <= now.getTime()) {
    await prisma.rateLimitBucket.delete({ where: { key } }).catch(() => undefined);
    return false;
  }
  return Boolean(bucket.blockedUntil && bucket.blockedUntil > now) || bucket.count >= loginAttemptLimit;
};

const recordLoginFailure = async (key: string) => {
  const now = new Date();
  await prisma.$transaction(async (transaction) => {
    const current = await transaction.rateLimitBucket.findUnique({ where: { key } });
    if (!current || current.firstAt.getTime() + loginAttemptWindowMs <= now.getTime()) {
      await transaction.rateLimitBucket.upsert({ where: { key }, update: { count: 1, firstAt: now, blockedUntil: null }, create: { key, count: 1, firstAt: now } });
      return;
    }
    const count = current.count + 1;
    await transaction.rateLimitBucket.update({ where: { key }, data: { count, blockedUntil: count >= loginAttemptLimit ? new Date(now.getTime() + loginAttemptWindowMs) : null } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
};

const clearLoginFailures = async (key: string) => {
  await prisma.rateLimitBucket.deleteMany({ where: { key } });
};

const measureDatabaseHealth = async () => {
  const startedAt = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { status: "connected" as const, latencyMs: Date.now() - startedAt };
  } catch {
    return { status: "unavailable" as const, latencyMs: null };
  }
};

const requireSession = async (request: Request, response: Response, next: NextFunction) => {
  const token = getBearerToken(request);
  if (!token) return response.status(401).json({ message: "Sesión no encontrada" });

  const session = await prisma.session.findFirst({ where: { tokenHash: hashToken(token), expiresAt: { gt: new Date() } }, include: sessionInclude });
  if (!session) return response.status(401).json({ message: "La sesión ha expirado" });

  response.locals.session = serializeSession(session as SessionRecord, token);
  return next();
};

app.get("/api/health", async (_request, response) => {
  const database = await measureDatabaseHealth();
  const healthy = database.status === "connected";
  response.status(healthy ? 200 : 503).json({ status: healthy ? "ok" : "degraded", service: "api", database: database.status, latencyMs: database.latencyMs, timestamp: new Date().toISOString() });
});

app.post("/api/auth/login", async (request, response) => {
  const { username, password } = request.body as { username?: unknown; password?: unknown };
  if (typeof username !== "string" || typeof password !== "string" || !username || !password) {
    return response.status(400).json({ message: "Usuario y contraseña son obligatorios" });
  }
  if (username.length > 80 || password.length > 200) return response.status(400).json({ message: "Las credenciales superan la longitud permitida" });
  const attemptKey = `${request.ip ?? "unknown"}:${username.toLowerCase()}`;
  if (await loginRateLimited(attemptKey)) {
    return response.status(429).json({ message: "Demasiados intentos. Espera unos minutos antes de volver a intentarlo." });
  }

  const user = await prisma.user.findUnique({ where: { username }, include: { assignments: true } });
  if (!user?.active || !(await compare(password, user.passwordHash))) {
    await recordLoginFailure(attemptKey);
    return response.status(401).json({ message: "Usuario o contraseña incorrectos" });
  }
  await clearLoginFailures(attemptKey);

  const assignment = user.assignments[0];
  if (!assignment) return response.status(403).json({ message: "El usuario no tiene una instalación asignada" });

  const token = randomBytes(32).toString("hex");
  await prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  const session = await prisma.session.create({
    data: { tokenHash: hashToken(token), userId: user.id, installationId: assignment.installationId, expiresAt: new Date(Date.now() + sessionDurationMs) },
    include: sessionInclude,
  });

  return response.json(serializeSession(session as SessionRecord, token));
});

app.post("/api/auth/logout", requireSession, async (request, response) => {
  const token = getBearerToken(request);
  if (token) await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  return response.status(204).send();
});

app.get("/api/auth/me", requireSession, (_request, response) => response.json(response.locals.session));

app.get("/api/dashboard", requireSession, async (_request, response) => {
  const session = response.locals.session as SessionContext;
  const [stock, pendingReceipts, pickingTasks, shipmentsToday] = await Promise.all([
    prisma.stockItem.aggregate({ where: { installationId: session.installation.id }, _sum: { quantity: true } }),
    prisma.receipt.count({ where: { installationId: session.installation.id, status: { in: ["Pendiente", "En descarga", "Parcial"] } } }),
    prisma.pickingTask.count({ where: { installationId: session.installation.id, status: { in: ["Pendiente", "En curso", "Pausado"] } } }),
    prisma.shipment.count({ where: { installationId: session.installation.id, status: { in: ["Pendiente", "Listo para cargar", "En tránsito"] } } }),
  ]);
  return response.json({ installation: session.installation.name, client: session.client.name, metrics: { stock: stock._sum.quantity ?? 0, pendingReceipts, pickingTasks, shipmentsToday } });
});

const workspaceResources = new Set<WorkspaceResource>(["stock", "receipts", "picking", "shipments", "installations", "locations", "movements", "inventory", "queries", "users", "products", "replenishment", "suppliers", "customers", "integrations", "audit", "roles"]);
const configurationRoles = new Set(["DEVELOPER", "PRODUCT_OWNER"]);
const hasPermission = (session: SessionContext, permission: string) => session.role.permissions.includes(permission);
const requirePermission = (session: SessionContext, permission: string) => hasPermission(session, permission) || configurationRoles.has(session.role.key);
const configurableQueryResources = new Set(["stock", "receipts", "picking", "shipments", "inventory", "movements", "queries", "locations", "products", "replenishment", "suppliers", "customers", "users", "roles", "integrations"]);
const storedWorkspaceResources = new Set(["receipts", "picking", "shipments", "locations", "movements", "inventory", "queries", "users", "products", "replenishment", "suppliers", "customers", "integrations", "audit", "roles"]);
const typedWorkspaceResources = new Set(["receipts", "picking", "shipments", "locations", "inventory", "replenishment", "products", "suppliers", "customers", "integrations", "movements", "queries", "users", "roles"]);
const getRouteResource = (resource: string | string[]) => Array.isArray(resource) ? resource[0] : resource;

app.get("/api/metrics", requireSession, async (_request, response) => {
  const session = response.locals.session as SessionContext;
  if (session.role.key !== "DEVELOPER") return response.status(403).json({ message: "Este panel está reservado al rol Developer" });
  const routes = Object.fromEntries(Array.from(requestMetrics.entries()).map(([route, metric]) => [route, { ...metric, averageMs: metric.count ? Math.round(metric.totalMs / metric.count) : 0 }]));
  const database = await measureDatabaseHealth();
  return response.json({ generatedAt: new Date().toISOString(), uptimeSeconds: Math.round(process.uptime()), memory: process.memoryUsage(), database, slowRequestThresholdMs, slowRequests: slowRequests.slice(0, 20), routes });
});

type InstallationInput = {
  code: string;
  name: string;
  city: string;
  timezone: string;
  environment: string;
  version: string;
  status: string;
  manager: string;
};

const parseInstallationInput = (body: Record<string, unknown>): InstallationInput | { error: string } => {
  const text = (key: string, fallback = "") => typeof body[key] === "string" ? body[key].trim() : fallback;
  const input: InstallationInput = {
    code: text("code").toUpperCase(),
    name: text("name"),
    city: text("city", "Madrid"),
    timezone: text("timezone", "Europe/Madrid"),
    environment: text("environment", "Producción"),
    version: text("version", "0.1.0"),
    status: text("status", "Activa"),
    manager: text("manager"),
  };
  if (!input.code || !/^[A-Z0-9_-]+$/.test(input.code)) return { error: "El código solo puede contener letras, números, guiones y guiones bajos" };
  if (!input.name) return { error: "El nombre de la instalación es obligatorio" };
  if (input.code.length > 48 || input.name.length > 120 || input.city.length > 80 || input.timezone.length > 64 || input.environment.length > 40 || input.version.length > 32 || input.status.length > 40 || input.manager.length > 120) {
    return { error: "Uno de los campos supera la longitud permitida" };
  }
  return input;
};

const serializeInstallation = (installation: {
  id: string; code: string; name: string; city: string; timezone: string; environment: string; version: string; status: string; managerName: string | null; modulesSummary: string; lastSyncAt: Date | null; updatedAt: Date; _count: { warehouses: number; assignments: number };
}) => ({
  id: installation.id,
  code: installation.code,
  name: installation.name,
  city: installation.city,
  timezone: installation.timezone,
  warehouses: installation._count.warehouses,
  environment: installation.environment,
  version: installation.version,
  status: installation.status,
  users: installation._count.assignments,
  manager: installation.managerName ?? "—",
  modules: installation.modulesSummary,
  lastSync: installation.lastSyncAt?.toISOString() ?? "—",
  updatedAt: installation.updatedAt.toISOString(),
});

app.put("/api/installations/:id", requireSession, async (request, response) => {
  const session = response.locals.session as SessionContext;
  if (!requirePermission(session, "users.manage")) return response.status(403).json({ message: "Se requiere el permiso users.manage para editar instalaciones" });
  const installation = await prisma.installation.findFirst({ where: { id: getRouteResource(request.params.id), clientId: session.client.id }, include: { _count: { select: { warehouses: true, assignments: true } } } });
  if (!installation) return response.status(404).json({ message: "Instalación no encontrada" });
  const parsed = parseInstallationInput(request.body as Record<string, unknown>);
  if ("error" in parsed) return response.status(400).json({ message: parsed.error });
  const duplicate = await prisma.installation.findFirst({ where: { clientId: session.client.id, code: parsed.code, NOT: { id: installation.id } } });
  if (duplicate) return response.status(409).json({ message: "Ya existe una instalación con ese código" });

  const saved = await prisma.$transaction(async (transaction) => {
    const updated = await transaction.installation.update({
      where: { id: installation.id },
      data: { code: parsed.code, name: parsed.name, city: parsed.city, timezone: parsed.timezone, environment: parsed.environment, version: parsed.version, status: parsed.status, active: parsed.status !== "Inactiva", managerName: parsed.manager || null },
      include: { _count: { select: { warehouses: true, assignments: true } } },
    });
    await transaction.auditEvent.create({
      data: { clientId: session.client.id, installationId: installation.id, userId: session.user.id, eventType: "CONFIGURATION", resource: "installations", action: "INSTALLATION_UPDATED", entityId: installation.id, details: { code: parsed.code, name: parsed.name, status: parsed.status, version: parsed.version } },
    });
    return updated;
  });
  return response.json(serializeInstallation(saved));
});

app.post("/api/installations", requireSession, async (request, response) => {
  const session = response.locals.session as SessionContext;
  if (!requirePermission(session, "users.manage")) return response.status(403).json({ message: "Se requiere el permiso users.manage para crear instalaciones" });
  const parsed = parseInstallationInput(request.body as Record<string, unknown>);
  if ("error" in parsed) return response.status(400).json({ message: parsed.error });
  const duplicate = await prisma.installation.findFirst({ where: { clientId: session.client.id, code: parsed.code } });
  if (duplicate) return response.status(409).json({ message: "Ya existe una instalación con ese código" });
  const saved = await prisma.$transaction(async (transaction) => {
    const created = await transaction.installation.create({
      data: { clientId: session.client.id, code: parsed.code, name: parsed.name, city: parsed.city, timezone: parsed.timezone, environment: parsed.environment, version: parsed.version, status: parsed.status, active: parsed.status !== "Inactiva", managerName: parsed.manager || null },
      include: { _count: { select: { warehouses: true, assignments: true } } },
    });
    await transaction.auditEvent.create({
      data: { clientId: session.client.id, installationId: created.id, userId: session.user.id, eventType: "CONFIGURATION", resource: "installations", action: "INSTALLATION_CREATED", entityId: created.id, details: { code: parsed.code, name: parsed.name, status: parsed.status, version: parsed.version } },
    });
    return created;
  });
  return response.status(201).json(serializeInstallation(saved));
});

const serializeQueryConfiguration = (configuration: Awaited<ReturnType<typeof prisma.queryConfiguration.findUniqueOrThrow>>) => ({
  id: configuration.id,
  resource: configuration.resource,
  installationId: configuration.installationId,
  installation: configuration.installationId,
  name: configuration.name,
  description: configuration.description,
  sqlText: configuration.sqlText,
  columns: configuration.columns,
  filters: configuration.filters,
  parameters: configuration.parameters,
  defaultSort: configuration.defaultSort,
  actions: configuration.actions,
  allowedRoles: configuration.allowedRoles,
  status: configuration.status,
  version: configuration.version,
  publishedAt: configuration.publishedAt,
  updatedByName: configuration.updatedByName,
  updatedAt: configuration.updatedAt,
});

const getQueryConfigBody = (body: Record<string, unknown>) => {
  const list = (value: unknown) => Array.isArray(value) ? value : [];
  return {
    name: typeof body.name === "string" && body.name.trim() ? body.name.trim() : "Consulta sin nombre",
    description: typeof body.description === "string" ? body.description.trim() : null,
    sqlText: typeof body.sqlText === "string" ? body.sqlText.trim() : "",
    columns: list(body.columns),
    filters: list(body.filters),
    parameters: list(body.parameters).map(String),
    defaultSort: typeof body.defaultSort === "string" ? body.defaultSort.trim() : null,
    actions: list(body.actions),
    allowedRoles: list(body.allowedRoles),
  };
};

const validateReadOnlySql = (sqlText: string) => {
  const normalized = sqlText.replace(/--.*$/gm, "").trim().replace(/;+$/, "").trim().toLowerCase();
  if (!/^(select|with)\b/.test(normalized)) return "La consulta debe comenzar por SELECT o WITH";
  if (normalized.includes(";")) return "Solo se permite una sentencia SQL";
  if (/\b(insert|update|delete|drop|alter|truncate|create|grant|revoke|copy|execute)\b/.test(normalized)) return "La consulta contiene una operación no permitida";
  return null;
};

const validateConfiguredStockSql = (sqlText: string) => {
  const basicError = validateReadOnlySql(sqlText);
  if (basicError) return basicError;
  const normalized = sqlText.trim().toLowerCase();
  if (!/^select\b/.test(normalized)) return "La consulta de Stock debe comenzar por SELECT";
  if (!/:installationid\b/.test(normalized)) return "La consulta de Stock debe usar el parámetro :installationId";
  if (!/\bfrom\s+stock\b/.test(normalized)) return "La consulta de Stock debe leer desde la vista lógica stock";
  if (/\$\d+|\b(with|union|join|into|for\s+update|pg_catalog|information_schema|pg_sleep|dblink|current_user|session_user)\b/.test(normalized)) return "La consulta contiene una estructura no permitida";
  const sources = [...normalized.matchAll(/\bfrom\s+([a-z_][a-z0-9_]*)/g)].map((match) => match[1]);
  if (sources.some((source) => source !== "stock")) return "La consulta solo puede leer desde stock";
  const parameters = [...normalized.matchAll(/:([a-z_][a-z0-9_]*)/g)].map((match) => match[1]);
  if (parameters.some((parameter) => parameter !== "installationid")) return "Solo se permite el parámetro :installationId en esta primera versión";
  return null;
};

const validateConfiguredResourceSql = (resource: string, sqlText: string) => {
  if (resource === "stock") return validateConfiguredStockSql(sqlText);
  const basicError = validateReadOnlySql(sqlText);
  if (basicError) return basicError;
  const normalized = sqlText.trim().toLowerCase();
  if (!/^select\b/.test(normalized)) return "Las consultas configurables deben comenzar por SELECT";
  if (!/:installationid\b/.test(normalized) || !/\binstallation_id\s*=\s*:installationid\b/.test(normalized)) return "La consulta debe filtrar por :installationId";
  if (/\b(with|union|join|into|for\s+update|pg_catalog|information_schema|pg_sleep|dblink|current_user|session_user|create|alter|drop)\b/.test(normalized)) return "La consulta contiene una estructura no permitida";
  const sources = [...normalized.matchAll(/\bfrom\s+([a-z_][a-z0-9_]*)/g)].map((match) => match[1]);
  if (sources.length !== 1 || sources[0] !== resource) return `La consulta solo puede leer desde la vista ${resource}`;
  return null;
};

const serializeQueryValue = (value: unknown): string | number | null => {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string" || typeof value === "number") return value;
  if (typeof value === "boolean") return value ? 1 : 0;
  return String(value);
};

const executeConfiguredStockQuery = async (session: SessionContext, sqlText: string) => {
  const sqlError = validateConfiguredStockSql(sqlText);
  if (sqlError) throw new Error(sqlError);
  const parameterizedSql = sqlText.trim().replace(/:installationId\b/g, "$1").replace(/;+$/, "");
  const rows = await prisma.$transaction(async (transaction) => {
    await transaction.$executeRawUnsafe("SET LOCAL statement_timeout = 5000");
    return transaction.$queryRawUnsafe<Array<Record<string, unknown>>>(`SELECT * FROM (${parameterizedSql}) AS configured_stock LIMIT $2`, session.installation.id, 10000);
  });
  return rows.map((row, index) => {
    const serialized = Object.fromEntries(Object.entries(row).map(([key, value]) => [key, serializeQueryValue(value)]));
    return { ...serialized, id: typeof serialized.id === "string" ? serialized.id : `query-row-${index + 1}` };
  });
};

const executeConfiguredWorkspaceQuery = async (session: SessionContext, resource: string, sqlText: string) => {
  const sqlError = validateConfiguredResourceSql(resource, sqlText);
  if (sqlError) throw new Error(sqlError);
  const parameterizedSql = sqlText.trim().replace(/:installationId\b/g, "$1").replace(/;+$/, "");
  const rows = await prisma.$transaction(async (transaction) => {
    await transaction.$executeRawUnsafe("SET LOCAL statement_timeout = 5000");
    return transaction.$queryRawUnsafe<Array<Record<string, unknown>>>(`SELECT * FROM (${parameterizedSql}) AS configured_rows LIMIT $2`, session.installation.id, 10000);
  });
  return rows.map((row, index) => {
    const serialized = Object.fromEntries(Object.entries(row).map(([key, value]) => [key, serializeQueryValue(value)]));
    return { ...serialized, id: typeof serialized.id === "string" ? serialized.id : `query-row-${index + 1}` };
  });
};

const recordQueryConfigurationVersion = async (configuration: { id: string; version: number }, data: ReturnType<typeof getQueryConfigBody>, updatedByName: string) => {
  await prisma.queryConfigurationVersion.upsert({
    where: { queryConfigurationId_version: { queryConfigurationId: configuration.id, version: configuration.version } },
    update: { payload: data, createdByName: updatedByName },
    create: { queryConfigurationId: configuration.id, version: configuration.version, payload: data, createdByName: updatedByName },
  });
};

const recordAuditEvent = async (session: SessionContext, event: { eventType: string; resource: string; action: string; entityId?: string; installationId?: string; details?: Prisma.InputJsonValue; outcome?: string }) => {
  await prisma.auditEvent.create({
    data: {
      clientId: session.client.id,
      installationId: event.installationId ?? session.installation.id,
      userId: session.user.id,
      eventType: event.eventType,
      resource: event.resource,
      action: event.action,
      entityId: event.entityId,
      details: event.details,
      outcome: event.outcome ?? "SUCCESS",
    },
  });
};

app.post("/api/support/incidents", requireSession, async (request, response) => {
  const session = response.locals.session as SessionContext;
  const body = request.body ?? {};
  const code = typeof body.code === "string" ? body.code.trim().slice(0, 80) : "OPERACION_NO_COMPLETADA";
  const title = typeof body.title === "string" ? body.title.trim().slice(0, 180) : "Incidencia de operación";
  const message = typeof body.message === "string" ? body.message.trim().slice(0, 500) : "No se ha podido completar una operación";
  const technicalMessage = typeof body.technicalMessage === "string" ? body.technicalMessage.trim().slice(0, 500) : "";
  const userDescription = typeof body.userDescription === "string" ? body.userDescription.trim().slice(0, 1000) : "";
  const route = typeof body.route === "string" ? body.route.trim().slice(0, 180) : "";
  const resource = typeof body.resource === "string" ? body.resource.trim().slice(0, 80) : "";
  const action = typeof body.action === "string" ? body.action.trim().slice(0, 120) : "";
  const screenshotDataUrl = typeof body.screenshotDataUrl === "string" && body.screenshotDataUrl.length <= 750_000 ? body.screenshotDataUrl : "";
  const screenshotName = typeof body.screenshotName === "string" ? body.screenshotName.trim().slice(0, 160) : "";
  if (!message) return response.status(400).json({ message: "El mensaje de la incidencia es obligatorio" });
  if (typeof body.screenshotDataUrl === "string" && body.screenshotDataUrl.length > 750_000) return response.status(413).json({ message: "La captura supera el límite permitido de 750 KB" });

  const reference = `INC-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString("hex").toUpperCase()}`;
  let delivery: "LOCAL" | "EXTERNAL" = "LOCAL";
  if (supportWebhookUrl) {
    try {
      const externalResponse = await fetch(supportWebhookUrl, { method: "POST", headers: { "Content-Type": "application/json", "X-SGA-Incident": reference }, body: JSON.stringify({ reference, code, title, message, technicalMessage, userDescription, route, resource, action, screenshotName: screenshotName || null, screenshotDataUrl: screenshotDataUrl || null, installation: session.installation.name, client: session.client.name, user: session.user.displayName }) });
      if (externalResponse.ok) delivery = "EXTERNAL";
    } catch (error) {
      console.warn(`No se pudo reenviar ${reference} al webhook de soporte`, error);
    }
  }
  await recordAuditEvent(session, {
    eventType: "SUPPORT",
    resource: "support",
    action: "REPORT_INCIDENT",
    entityId: reference,
    outcome: "OPEN",
    details: { reference, code, title, message, technicalMessage: technicalMessage || null, userDescription, route, resource, action, delivery, screenshotAttached: Boolean(screenshotDataUrl), screenshotName: screenshotName || null, screenshotDataUrl: screenshotDataUrl || null },
  });
  return response.status(201).json({ reference, delivery, message: delivery === "EXTERNAL" ? "Incidencia enviada a soporte" : "Incidencia guardada en Auditoría. Soporte puede localizarla con esta referencia." });
});

const recordToolRun = async (session: SessionContext, tool: string, input: Prisma.InputJsonValue, output: Prisma.InputJsonValue, status = "COMPLETED", error?: string) => {
  const run = await prisma.toolRun.create({ data: { clientId: session.client.id, installationId: session.installation.id, userId: session.user.id, tool, status, input, output, error, completedAt: new Date() } });
  await recordAuditEvent(session, { eventType: "TOOL", resource: "tools", action: `TOOL_${tool.toUpperCase()}_${status}`, entityId: run.id, details: { tool, status } });
  return run;
};

const parseToolResource = (value: unknown) => typeof value === "string" && configurableQueryResources.has(value) ? value : null;

app.post("/api/tools/sql/execute", requireSession, async (request, response) => {
  const session = response.locals.session as SessionContext;
  if (!requirePermission(session, "tools.sql.execute")) return response.status(403).json({ message: "SQL Helper requiere el permiso tools.sql.execute" });
  const resource = parseToolResource(request.body?.resource);
  const sqlText = typeof request.body?.sqlText === "string" ? request.body.sqlText.trim() : "";
  if (!resource || !sqlText) return response.status(400).json({ message: "Recurso y consulta son obligatorios" });
  const validationError = validateConfiguredResourceSql(resource, sqlText);
  if (validationError) return response.status(400).json({ message: validationError });
  const startedAt = Date.now();
  try {
    const rows = resource === "stock" ? await executeConfiguredStockQuery(session, sqlText) : await executeConfiguredWorkspaceQuery(session, resource, sqlText);
    const output = { rows, rowCount: rows.length, durationMs: Date.now() - startedAt, limited: rows.length >= 10000 };
    await recordToolRun(session, "sql", { resource, sqlText } as Prisma.InputJsonValue, output as Prisma.InputJsonValue);
    return response.json(output);
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo ejecutar la consulta";
    await recordToolRun(session, "sql", { resource, sqlText } as Prisma.InputJsonValue, { rowCount: 0 } as Prisma.InputJsonValue, "FAILED", message);
    return response.status(422).json({ message });
  }
});

app.post("/api/tools/loop/execute", requireSession, async (request, response) => {
  const session = response.locals.session as SessionContext;
  const resource = typeof request.body?.resource === "string" ? request.body.resource : "";
  const ids = Array.isArray(request.body?.ids) ? request.body.ids.map(String).slice(0, 100) : [];
  const nextStatus = typeof request.body?.status === "string" ? request.body.status.trim() : "";
  if (!storedWorkspaceResources.has(resource) || !ids.length || !nextStatus || nextStatus.length > 40) return response.status(400).json({ message: "Recurso, registros y estado destino son obligatorios" });
  if (!hasPermission(session, "tools.loop.execute") || !canAccessWorkspaceResource(resource, session)) return response.status(403).json({ message: "Tu rol no puede ejecutar este proceso masivo" });
  const updated = await prisma.$transaction(async (transaction) => {
    if (typedWorkspaceResources.has(resource)) {
      let count = 0;
      for (const id of ids) {
        const saved = await updateTypedWorkspaceRecord(transaction, session, resource, id, { status: nextStatus });
        if (saved) count += 1;
      }
      return count;
    }
    const records = await transaction.workspaceRecord.findMany({ where: { id: { in: ids }, installationId: session.installation.id, resource } });
    for (const record of records) {
      const currentPayload = record.payload && typeof record.payload === "object" ? record.payload as Record<string, unknown> : {};
      await transaction.workspaceRecord.update({ where: { id: record.id }, data: { status: nextStatus, payload: { ...currentPayload, status: nextStatus } as Prisma.InputJsonValue } });
    }
    return records.length;
  });
  await recordToolRun(session, "loop", { resource, ids, status: nextStatus } as Prisma.InputJsonValue, { updated } as Prisma.InputJsonValue);
  return response.json({ updated, status: nextStatus });
});

app.post("/api/tools/updater/publish", requireSession, async (request, response) => {
  const session = response.locals.session as SessionContext;
  if (!requirePermission(session, "tools.updater.publish")) return response.status(403).json({ message: "Updater requiere el permiso tools.updater.publish" });
  const version = typeof request.body?.version === "string" ? request.body.version.trim() : "";
  const environment = typeof request.body?.environment === "string" ? request.body.environment.trim() : session.installation.environment;
  if (!version || version.length > 32) return response.status(400).json({ message: "La versión es obligatoria" });
  const updated = await prisma.installation.update({ where: { id: session.installation.id }, data: { version, environment, lastSyncAt: new Date() } });
  await recordToolRun(session, "updater", { version, environment } as Prisma.InputJsonValue, { installationId: updated.id, version: updated.version } as Prisma.InputJsonValue);
  return response.json({ installationId: updated.id, version: updated.version, environment: updated.environment, publishedAt: updated.lastSyncAt });
});

const parseXmlAttributes = (source: string) => Object.fromEntries(Array.from(source.matchAll(/([a-zA-Z][a-zA-Z0-9_-]*)\s*=\s*["']([^"']*)["']/g)).map((match) => [match[1], match[2]]));

app.post("/api/tools/xml/import", requireSession, async (request, response) => {
  const session = response.locals.session as SessionContext;
  if (!hasPermission(session, "tools.xml.import")) return response.status(403).json({ message: "Tu rol no puede importar recepciones" });
  const xml = typeof request.body?.xml === "string" ? request.body.xml.trim() : "";
  if (!xml || xml.length > 100000 || /<!doctype|<!entity/i.test(xml) || !/^<recepcion\b/i.test(xml)) return response.status(400).json({ message: "XML no válido o no permitido" });
  const rootMatch = xml.match(/^<recepcion\b([^>]*)>/i);
  const lines = Array.from(xml.matchAll(/<linea\b([^>]*)\/?>(?:<\/linea>)?/gi) as Iterable<RegExpMatchArray>).map((match) => parseXmlAttributes(match[1]));
  if (!rootMatch || !lines.length || lines.some((line) => !line.sku || !/^\d+(?:\.\d+)?$/.test(line.cantidad ?? ""))) return response.status(400).json({ message: "Cada línea XML necesita sku y cantidad numérica" });
  const attributes = parseXmlAttributes(rootMatch[1]);
  const reference = attributes.referencia || `RC-XML-${Date.now()}`;
  const payload = { id: `receipt-xml-${randomBytes(8).toString("hex")}`, reference, supplier: attributes.proveedor || "Importación XML", supplierDocument: attributes.albaran || "—", units: lines.reduce((total, line) => total + Number(line.cantidad), 0), lines: lines.length, status: "Pendiente", qualityCheck: "Pendiente", importedLines: lines };
  const record = await prisma.receipt.create({ data: { id: payload.id, installationId: session.installation.id, reference, supplier: payload.supplier, supplierDocument: payload.supplierDocument, lines: payload.lines, units: payload.units, status: payload.status, qualityCheck: payload.qualityCheck, notes: JSON.stringify({ importedLines: lines }) } });
  await recordToolRun(session, "xml", { reference, lineCount: lines.length } as Prisma.InputJsonValue, { receiptId: record.id, lineCount: lines.length } as Prisma.InputJsonValue);
  return response.status(201).json({ receipt: serializePrismaWorkspaceRow(record as unknown as Record<string, unknown>), lineCount: lines.length });
});

app.get("/api/tools/runs", requireSession, async (request, response) => {
  const session = response.locals.session as SessionContext;
  const runs = await prisma.toolRun.findMany({ where: { installationId: session.installation.id }, orderBy: { createdAt: "desc" }, take: 100 });
  return response.json({ items: runs.map((run) => ({ id: run.id, tool: run.tool, status: run.status, createdAt: run.createdAt, completedAt: run.completedAt, error: run.error })) });
});

app.post("/api/integrations/:id/run", requireSession, async (request, response) => {
  const session = response.locals.session as SessionContext;
  if (!requirePermission(session, "integrations.execute")) return response.status(403).json({ message: "Tu rol no puede ejecutar integraciones" });
  const id = getRouteResource(request.params.id);
  const current = await prisma.integration.findFirst({ where: { id, installationId: session.installation.id } });
  if (!current) return response.status(404).json({ message: "Integración no encontrada" });
  const execution = await executeIntegrationAdapter({ code: current.code, protocol: current.protocol, endpoint: current.endpoint, direction: current.direction, installationCode: current.installationCode ?? session.installation.code });
  const updated = await prisma.integration.update({ where: { id }, data: { status: execution.ok ? "Operativa" : "Error", lastExecution: new Date(), lastError: execution.error ?? null, latencyMs: execution.latencyMs, ...(execution.ok ? { processed: { increment: execution.processed }, failed: { set: 0 } } : { failed: { increment: 1 } }) } });
  await recordToolRun(session, "integration", { integrationId: id, protocol: current.protocol, mode: execution.mode } as Prisma.InputJsonValue, { status: updated.status, processed: updated.processed, failed: updated.failed, mode: execution.mode, error: execution.error ?? null } as Prisma.InputJsonValue, execution.ok ? "COMPLETED" : "FAILED", execution.error);
  await recordAuditEvent(session, { eventType: "INTEGRATION", resource: "integrations", action: "RUN_INTEGRATION", entityId: id, outcome: execution.ok ? "SUCCESS" : "ERROR", details: { name: current.name, protocol: current.protocol, mode: execution.mode, error: execution.error ?? null } });
  return response.status(execution.ok ? 200 : 502).json({ ...serializePrismaWorkspaceRow({ ...updated, installation: updated.installationCode } as unknown as Record<string, unknown>), execution });
});

app.post("/api/integrations/retry", requireSession, async (request, response) => {
  const session = response.locals.session as SessionContext;
  if (!requirePermission(session, "integrations.execute")) return response.status(403).json({ message: "Tu rol no puede reintentar integraciones" });
  const records = await prisma.integration.findMany({ where: { installationId: session.installation.id } });
  let updated = 0;
  let failed = 0;
  for (const record of records) {
    if (record.failed <= 0 && !record.status.toLowerCase().includes("error")) continue;
    const execution = await executeIntegrationAdapter({ code: record.code, protocol: record.protocol, endpoint: record.endpoint, direction: record.direction, installationCode: record.installationCode ?? session.installation.code });
    await prisma.integration.update({ where: { id: record.id }, data: { status: execution.ok ? "Operativa" : "Error", failed: execution.ok ? { set: 0 } : { increment: 1 }, lastExecution: new Date(), lastError: execution.error ?? null, latencyMs: execution.latencyMs, ...(execution.ok ? { processed: { increment: execution.processed } } : {}) } });
    if (execution.ok) updated += 1; else failed += 1;
  }
  const mode = String(process.env.INTEGRATION_EXECUTION_MODE ?? "SIMULATED").toUpperCase() === "EXTERNAL" ? "EXTERNAL" : "SIMULATED";
  await recordToolRun(session, "integration-retry", { mode } as Prisma.InputJsonValue, { updated, failed, mode } as Prisma.InputJsonValue, failed > 0 ? "FAILED" : "COMPLETED", failed > 0 ? `${failed} integraciones no pudieron reintentarse` : undefined);
  await recordAuditEvent(session, { eventType: "INTEGRATION", resource: "integrations", action: "RETRY_INTEGRATIONS", outcome: failed > 0 ? "ERROR" : "SUCCESS", details: { updated, failed, mode } });
  return response.status(failed > 0 ? 207 : 200).json({ updated, failed, mode });
});

type PageActionPayload = {
  id: string;
  label: string;
  kind: "defined" | "custom";
  actionType: "operation" | "export" | "navigation" | "custom";
  enabled: boolean;
  variant: "primary" | "secondary" | "danger";
  roleKeys?: string[];
  targetResource?: string;
};

const getPageActionsBody = (body: Record<string, unknown>) => {
  if (!Array.isArray(body.actions)) return { error: "La lista de acciones es obligatoria" as string | null, actions: [] as PageActionPayload[] };
  const actions: PageActionPayload[] = [];
  const ids = new Set<string>();
  for (const entry of body.actions) {
    if (!entry || typeof entry !== "object") return { error: "Cada acción debe ser un objeto" as string | null, actions };
    const candidate = entry as Record<string, unknown>;
    const id = typeof candidate.id === "string" ? candidate.id.trim() : "";
    const label = typeof candidate.label === "string" ? candidate.label.trim() : "";
    const kind = candidate.kind === "custom" ? "custom" : candidate.kind === "defined" ? "defined" : null;
    const actionType = ["operation", "export", "navigation", "custom"].includes(String(candidate.actionType)) ? candidate.actionType as PageActionPayload["actionType"] : null;
    const variant = ["primary", "secondary", "danger"].includes(String(candidate.variant)) ? candidate.variant as PageActionPayload["variant"] : "secondary";
    if (!id || !/^[a-z0-9][a-z0-9-]{1,79}$/i.test(id) || ids.has(id)) return { error: "Cada acción necesita un identificador único y válido" as string | null, actions };
    if (!label || label.length > 80 || !kind || !actionType) return { error: "Cada acción necesita texto, tipo y comportamiento válidos" as string | null, actions };
    ids.add(id);
    actions.push({ id, label, kind, actionType, enabled: candidate.enabled !== false, variant, roleKeys: Array.isArray(candidate.roleKeys) ? candidate.roleKeys.map(String).slice(0, 8) : undefined, targetResource: typeof candidate.targetResource === "string" && workspaceResources.has(candidate.targetResource as WorkspaceResource) ? candidate.targetResource : undefined });
  }
  return { error: null, actions };
};

const serializePageActionConfiguration = (configuration: { id: string | null; resource: string; installationId: string; actions: unknown; version: number; updatedByName: string | null; updatedAt: Date | null }) => ({
  id: configuration.id,
  resource: configuration.resource,
  installationId: configuration.installationId,
  actions: configuration.actions,
  version: configuration.version,
  updatedByName: configuration.updatedByName,
  updatedAt: configuration.updatedAt?.toISOString() ?? null,
});

app.get("/api/page-actions/:resource", requireSession, async (request, response) => {
  const resource = getRouteResource(request.params.resource);
  if (!workspaceResources.has(resource as WorkspaceResource)) return response.status(404).json({ message: "Módulo no encontrado" });
  const session = response.locals.session as SessionContext;
  const configuration = await prisma.pageActionConfiguration.findUnique({ where: { installationId_resource: { installationId: session.installation.id, resource } } });
  if (!configuration) return response.json({ id: null, resource, installationId: session.installation.id, actions: [], version: 0, updatedByName: null, updatedAt: null });
  return response.json(serializePageActionConfiguration(configuration));
});

app.put("/api/page-actions/:resource", requireSession, async (request, response) => {
  const resource = getRouteResource(request.params.resource);
  if (!workspaceResources.has(resource as WorkspaceResource)) return response.status(404).json({ message: "Módulo no encontrado" });
  const session = response.locals.session as SessionContext;
  if (!requirePermission(session, "configuration.manage")) return response.status(403).json({ message: "Se requiere el permiso configuration.manage para configurar acciones" });
  const parsed = getPageActionsBody(request.body as Record<string, unknown>);
  if (parsed.error) return response.status(400).json({ message: parsed.error });
  const configuration = await prisma.pageActionConfiguration.upsert({
    where: { installationId_resource: { installationId: session.installation.id, resource } },
    update: { actions: parsed.actions, version: { increment: 1 }, updatedByName: session.user.displayName },
    create: { clientId: session.client.id, installationId: session.installation.id, resource, actions: parsed.actions, updatedByName: session.user.displayName },
  });
  await recordAuditEvent(session, { eventType: "CONFIGURATION", resource, action: "SAVE_PAGE_ACTIONS", entityId: configuration.id, details: { version: configuration.version, actionCount: parsed.actions.length } });
  return response.json(serializePageActionConfiguration(configuration));
});

app.get("/api/query-configurations/:resource", requireSession, async (request, response) => {
  const resource = getRouteResource(request.params.resource);
  if (!configurableQueryResources.has(resource)) return response.status(404).json({ message: "Esta sección no admite configuración de consulta" });

  const session = response.locals.session as SessionContext;
  const configuration = await prisma.queryConfiguration.findUnique({ where: { installationId_resource: { installationId: session.installation.id, resource } } });
  if (!configuration) return response.status(404).json({ message: "No hay una configuración publicada para esta instalación" });

  const allowedRoles = Array.isArray(configuration.allowedRoles) ? configuration.allowedRoles.map(String) : [];
  if (allowedRoles.length > 0 && !allowedRoles.includes(session.role.key)) return response.status(403).json({ message: "Tu rol no tiene acceso a esta consulta" });
  return response.json(serializeQueryConfiguration(configuration));
});

app.put("/api/query-configurations/:resource", requireSession, async (request, response) => {
  const resource = getRouteResource(request.params.resource);
  if (!configurableQueryResources.has(resource)) return response.status(404).json({ message: "Esta sección no admite configuración de consulta" });

  const session = response.locals.session as SessionContext;
  if (!requirePermission(session, "configuration.manage")) return response.status(403).json({ message: "Se requiere el permiso configuration.manage para configurar consultas" });

  const data = getQueryConfigBody(request.body as Record<string, unknown>);
  if (!data.sqlText) return response.status(400).json({ message: "El SQL parametrizado es obligatorio" });
  if (data.sqlText.length > 20000) return response.status(400).json({ message: "El SQL supera el límite permitido" });
  const sqlError = validateConfiguredResourceSql(resource, data.sqlText);
  if (sqlError) return response.status(400).json({ message: sqlError });

  const configuration = await prisma.queryConfiguration.upsert({
    where: { installationId_resource: { installationId: session.installation.id, resource } },
    update: { ...data, status: "DRAFT", version: { increment: 1 }, updatedByName: session.user.displayName },
    create: { ...data, clientId: session.client.id, installationId: session.installation.id, resource, status: "DRAFT", updatedByName: session.user.displayName },
  });
  await recordQueryConfigurationVersion(configuration, data, session.user.displayName);
  await recordAuditEvent(session, { eventType: "CONFIGURATION", resource, action: "SAVE_DRAFT", entityId: configuration.id, details: { version: configuration.version } });
  return response.json(serializeQueryConfiguration(configuration));
});

app.get("/api/query-configurations/:resource/versions", requireSession, async (request, response) => {
  const resource = getRouteResource(request.params.resource);
  if (!configurableQueryResources.has(resource)) return response.status(404).json({ message: "Esta sección no admite configuración de consulta" });
  const session = response.locals.session as SessionContext;
  if (!requirePermission(session, "configuration.manage")) return response.status(403).json({ message: "Se requiere el permiso configuration.manage para consultar versiones" });
  const configuration = await prisma.queryConfiguration.findUnique({ where: { installationId_resource: { installationId: session.installation.id, resource } } });
  if (!configuration) return response.status(404).json({ message: "No hay una configuración para esta instalación" });
  const versions = await prisma.queryConfigurationVersion.findMany({ where: { queryConfigurationId: configuration.id }, orderBy: { version: "desc" }, select: { version: true, createdByName: true, createdAt: true } });
  return response.json({ resource, installationId: session.installation.id, currentVersion: configuration.version, versions });
});

app.post("/api/query-configurations/:resource/versions/:version/rollback", requireSession, async (request, response) => {
  const resource = getRouteResource(request.params.resource);
  if (!configurableQueryResources.has(resource)) return response.status(404).json({ message: "Esta sección no admite configuración de consulta" });
  const session = response.locals.session as SessionContext;
  if (!requirePermission(session, "configuration.manage")) return response.status(403).json({ message: "Se requiere el permiso configuration.manage para restaurar consultas" });
  const targetVersion = Number(getRouteResource(request.params.version));
  if (!Number.isInteger(targetVersion) || targetVersion < 1) return response.status(400).json({ message: "La versión indicada no es válida" });
  const configuration = await prisma.queryConfiguration.findUnique({ where: { installationId_resource: { installationId: session.installation.id, resource } } });
  if (!configuration) return response.status(404).json({ message: "No hay una configuración para esta instalación" });
  const version = await prisma.queryConfigurationVersion.findUnique({ where: { queryConfigurationId_version: { queryConfigurationId: configuration.id, version: targetVersion } } });
  if (!version) return response.status(404).json({ message: "La versión solicitada no existe" });
  const data = getQueryConfigBody(version.payload as Record<string, unknown>);
  const sqlError = validateConfiguredResourceSql(resource, data.sqlText);
  if (sqlError) return response.status(400).json({ message: sqlError });
  const restored = await prisma.queryConfiguration.update({ where: { id: configuration.id }, data: { ...data, status: "DRAFT", version: { increment: 1 }, publishedAt: null, updatedByName: session.user.displayName } });
  await recordQueryConfigurationVersion(restored, data, session.user.displayName);
  await recordAuditEvent(session, { eventType: "CONFIGURATION", resource, action: "ROLLBACK", entityId: configuration.id, details: { restoredVersion: targetVersion, newVersion: restored.version } });
  return response.json(serializeQueryConfiguration(restored));
});

app.post("/api/query-configurations/:resource/publish", requireSession, async (request, response) => {
  const resource = getRouteResource(request.params.resource);
  if (!configurableQueryResources.has(resource)) return response.status(404).json({ message: "Esta sección no admite configuración de consulta" });

  const session = response.locals.session as SessionContext;
  if (!requirePermission(session, "configuration.manage")) return response.status(403).json({ message: "Se requiere el permiso configuration.manage para publicar consultas" });

  const draft = await prisma.queryConfiguration.findUnique({ where: { installationId_resource: { installationId: session.installation.id, resource } } });
  if (!draft) return response.status(404).json({ message: "No hay una configuración para publicar" });
  const validationError = validateConfiguredResourceSql(resource, draft.sqlText);
  if (validationError) return response.status(400).json({ message: validationError });

  const configuration = await prisma.queryConfiguration.update({
    where: { installationId_resource: { installationId: session.installation.id, resource } },
    data: { status: "PUBLISHED", version: { increment: 1 }, publishedAt: new Date(), updatedByName: session.user.displayName },
  });
  await recordAuditEvent(session, { eventType: "CONFIGURATION", resource, action: "PUBLISH", entityId: configuration.id, details: { version: configuration.version } });
  return response.json(serializeQueryConfiguration(configuration));
});

const serializeWorkspaceRecord = (record: { id: string; payload: unknown }) => {
  const payload = record.payload && typeof record.payload === "object" ? record.payload as Record<string, unknown> : {};
  const normalized = Object.fromEntries(Object.entries(payload).map(([key, value]) => [key, serializeQueryValue(value)]));
  return { ...normalized, id: String(normalized.id ?? record.id) } as SerializedWorkspaceRow;
};

const parseWorkspaceRecordBody = (body: Record<string, unknown>) => {
  const payload = body.payload && typeof body.payload === "object" && !Array.isArray(body.payload) ? body.payload as Record<string, unknown> : body;
  const sanitized = Object.fromEntries(Object.entries(payload).filter(([key]) => key !== "id").slice(0, 80));
  for (const [key, value] of Object.entries(sanitized)) {
    if (typeof value === "string" && value.length > 1000) return { error: `El campo ${key} supera la longitud permitida` as string | null, payload: {} as Record<string, unknown> };
  }
  return { error: null as string | null, payload: sanitized };
};

const canAccessWorkspaceResource = (resource: string, session: SessionContext) =>
  resource === "integrations" ? requirePermission(session, "integrations.execute") :
    resource === "users" || resource === "roles" ? requirePermission(session, "users.manage") :
      hasPermission(session, "workspace.operate");

const typedText = (payload: Record<string, unknown>, key: string, fallback: string | null = null) => typeof payload[key] === "string" && payload[key].trim() ? payload[key].trim() : fallback;
const typedInteger = (payload: Record<string, unknown>, key: string, fallback = 0) => Number.isFinite(Number(payload[key])) ? Math.trunc(Number(payload[key])) : fallback;
const typedFloat = (payload: Record<string, unknown>, key: string, fallback = 0) => Number.isFinite(Number(payload[key])) ? Number(payload[key]) : fallback;
const typedDate = (payload: Record<string, unknown>, key: string) => {
  const value = typedText(payload, key);
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const createTypedWorkspaceRecord = async (transaction: Prisma.TransactionClient, session: SessionContext, resource: string, id: string, payload: Record<string, unknown>, reference: string) => {
  let record: Record<string, unknown>;
  if (resource === "receipts") record = await transaction.receipt.create({ data: { id, installationId: session.installation.id, reference, supplier: typedText(payload, "supplier", "Proveedor no indicado") ?? "Proveedor no indicado", supplierDocument: typedText(payload, "supplierDocument"), purchaseOrder: typedText(payload, "purchaseOrder"), arrivalDate: typedDate(payload, "arrivalDate"), scheduledDate: typedDate(payload, "scheduledDate"), dock: typedText(payload, "dock"), carrier: typedText(payload, "carrier"), warehouse: typedText(payload, "warehouse"), lines: typedInteger(payload, "lines"), units: typedInteger(payload, "units"), priority: typedText(payload, "priority", "Normal") ?? "Normal", status: typedText(payload, "status", "Pendiente") ?? "Pendiente", receiver: typedText(payload, "receiver"), qualityCheck: typedText(payload, "qualityCheck", "Pendiente"), createdAt: typedDate(payload, "createdAt") ?? new Date(), notes: typedText(payload, "notes") } }) as unknown as Record<string, unknown>;
  else if (resource === "picking") record = await transaction.pickingTask.create({ data: { id, installationId: session.installation.id, reference, wave: typedText(payload, "wave"), orderNumber: typedText(payload, "order"), customer: typedText(payload, "customer"), route: typedText(payload, "route"), priority: typedText(payload, "priority", "Normal") ?? "Normal", zone: typedText(payload, "zone"), lines: typedInteger(payload, "lines"), units: typedInteger(payload, "units"), progress: Math.min(100, Math.max(0, typedInteger(payload, "progress"))), picker: typedText(payload, "picker", "Sin asignar"), status: typedText(payload, "status", "Pendiente") ?? "Pendiente", createdAt: typedDate(payload, "createdAt") ?? new Date(), dueAt: typedDate(payload, "dueAt"), startedAt: typedDate(payload, "startedAt"), carrier: typedText(payload, "carrier"), observations: typedText(payload, "observations") } }) as unknown as Record<string, unknown>;
  else if (resource === "shipments") record = await transaction.shipment.create({ data: { id, installationId: session.installation.id, reference, orderNumber: typedText(payload, "order"), customer: typedText(payload, "customer"), shippingDate: typedDate(payload, "shippingDate"), dock: typedText(payload, "dock"), route: typedText(payload, "route"), carrier: typedText(payload, "carrier"), tracking: typedText(payload, "tracking"), packages: typedInteger(payload, "packages"), units: typedInteger(payload, "units"), weightKg: typedFloat(payload, "weightKg"), status: typedText(payload, "status", "Preparando") ?? "Preparando", operator: typedText(payload, "operator"), service: typedText(payload, "service", "Estándar"), createdAt: typedDate(payload, "createdAt") ?? new Date(), notes: typedText(payload, "notes") } }) as unknown as Record<string, unknown>;
  else if (resource === "locations") record = await transaction.location.create({ data: { id, installationId: session.installation.id, code: reference, warehouse: typedText(payload, "warehouse"), zone: typedText(payload, "zone"), type: typedText(payload, "type", "Estantería"), aisle: typedText(payload, "aisle"), bay: typedText(payload, "bay"), level: typedInteger(payload, "level", 1), position: typedText(payload, "position"), capacity: typedInteger(payload, "capacity"), occupied: typedInteger(payload, "occupied"), utilization: Math.min(100, Math.max(0, typedInteger(payload, "utilization"))), status: typedText(payload, "status", "Disponible") ?? "Disponible", restriction: typedText(payload, "restriction"), lastInventory: typedDate(payload, "lastInventory"), updatedBy: session.user.displayName } }) as unknown as Record<string, unknown>;
  else if (resource === "inventory") record = await transaction.inventoryCount.create({ data: { id, installationId: session.installation.id, reference, cycle: typedText(payload, "cycle"), zone: typedText(payload, "zone"), location: typedText(payload, "location"), sku: typedText(payload, "sku"), description: typedText(payload, "description"), lot: typedText(payload, "lot"), expected: typedInteger(payload, "expected"), counted: typedInteger(payload, "counted"), difference: typedInteger(payload, "difference"), status: typedText(payload, "status", "Pendiente") ?? "Pendiente", counter: typedText(payload, "counter", session.user.displayName), countedAt: typedDate(payload, "countedAt"), recheck: typedText(payload, "recheck"), approvedBy: typedText(payload, "approvedBy"), lastCount: typedDate(payload, "lastCount"), notes: typedText(payload, "notes") } }) as unknown as Record<string, unknown>;
  else if (resource === "products") record = await transaction.product.create({ data: { id, installationId: session.installation.id, sku: typedText(payload, "sku", reference) ?? reference, gtin: typedText(payload, "gtin"), description: typedText(payload, "description", "Artículo sin descripción") ?? "Artículo sin descripción", family: typedText(payload, "family"), category: typedText(payload, "category"), brand: typedText(payload, "brand"), unit: typedText(payload, "unit", "uds"), packSize: typedInteger(payload, "packSize", 1), weightKg: typedFloat(payload, "weightKg"), dimensions: typedText(payload, "dimensions"), lotRequired: typedText(payload, "lotRequired"), expiryRequired: typedText(payload, "expiryRequired"), serialRequired: typedText(payload, "serialRequired"), supplier: typedText(payload, "supplier"), minStock: typedInteger(payload, "minStock"), maxStock: typedInteger(payload, "maxStock"), leadTimeDays: typedInteger(payload, "leadTimeDays"), active: typedText(payload, "active", "Sí") ?? "Sí", status: typedText(payload, "status", "Activo") ?? "Activo", updatedBy: session.user.displayName } }) as unknown as Record<string, unknown>;
  else if (resource === "suppliers") record = await transaction.supplier.create({ data: { id, installationId: session.installation.id, code: reference, name: typedText(payload, "name", "Proveedor sin nombre") ?? "Proveedor sin nombre", legalName: typedText(payload, "legalName"), taxId: typedText(payload, "taxId"), contact: typedText(payload, "contact"), email: typedText(payload, "email"), phone: typedText(payload, "phone"), country: typedText(payload, "country", "España"), city: typedText(payload, "city"), leadTimeDays: typedInteger(payload, "leadTimeDays"), serviceLevel: typedText(payload, "serviceLevel"), paymentTerms: typedText(payload, "paymentTerms"), incoterm: typedText(payload, "incoterm"), openOrders: typedInteger(payload, "openOrders"), lastOrder: typedDate(payload, "lastOrder"), active: typedText(payload, "active", "Sí") ?? "Sí", status: typedText(payload, "status", "Activo") ?? "Activo" } }) as unknown as Record<string, unknown>;
  else if (resource === "customers") record = await transaction.customer.create({ data: { id, installationId: session.installation.id, code: reference, name: typedText(payload, "name", "Cliente sin nombre") ?? "Cliente sin nombre", legalName: typedText(payload, "legalName"), taxId: typedText(payload, "taxId"), channel: typedText(payload, "channel"), segment: typedText(payload, "segment"), contact: typedText(payload, "contact"), email: typedText(payload, "email"), phone: typedText(payload, "phone"), city: typedText(payload, "city"), country: typedText(payload, "country", "España"), serviceLevel: typedText(payload, "serviceLevel"), routes: typedInteger(payload, "routes"), ordersMonth: typedInteger(payload, "ordersMonth"), lastOrder: typedDate(payload, "lastOrder"), active: typedText(payload, "active", "Sí") ?? "Sí", status: typedText(payload, "status", "Activo") ?? "Activo" } }) as unknown as Record<string, unknown>;
  else if (resource === "movements") record = await transaction.movementRecord.create({ data: { id, installationId: session.installation.id, reference, type: typedText(payload, "type", "Ajuste") ?? "Ajuste", sku: typedText(payload, "sku"), lot: typedText(payload, "lot"), origin: typedText(payload, "origin"), destination: typedText(payload, "destination"), quantity: typedInteger(payload, "quantity"), unit: typedText(payload, "unit", "uds"), operator: typedText(payload, "operator", session.user.displayName), reason: typedText(payload, "reason"), device: typedText(payload, "device", "Web/SGA"), status: typedText(payload, "status", "Pendiente") ?? "Pendiente", sourceDocument: typedText(payload, "sourceDocument"), createdAt: typedDate(payload, "createdAt") ?? new Date(), confirmedAt: typedDate(payload, "confirmedAt"), observations: typedText(payload, "observations") } }) as unknown as Record<string, unknown>;
  else if (resource === "queries") record = await transaction.savedQuery.create({ data: { id, installationId: session.installation.id, code: reference, name: typedText(payload, "name", "Consulta operativa") ?? "Consulta operativa", category: typedText(payload, "category"), source: typedText(payload, "source"), columns: typedInteger(payload, "columns"), filters: typedInteger(payload, "filters"), lastRun: typedDate(payload, "lastRun"), durationMs: typedInteger(payload, "durationMs"), executions: typedInteger(payload, "executions"), owner: typedText(payload, "owner", session.user.displayName), visibility: typedText(payload, "visibility", "Privada"), status: typedText(payload, "status", "Borrador") ?? "Borrador" } }) as unknown as Record<string, unknown>;
  else if (resource === "users") {
    const username = typedText(payload, "username", reference) ?? reference;
    const email = typedText(payload, "email", `${username}@nortelog.local`) ?? `${username}@nortelog.local`;
    const roleKey = typedText(payload, "roleKey", "WAREHOUSE_MANAGER") ?? "WAREHOUSE_MANAGER";
    const installationCode = typedText(payload, "installationCode", session.installation.code) ?? session.installation.code;
    const [role, installation] = await Promise.all([
      transaction.role.findUnique({ where: { key: roleKey } }),
      transaction.installation.findFirst({ where: { clientId: session.client.id, code: installationCode } }),
    ]);
    if (!role || !installation) throw new Error("El rol o la instalación indicada no existe para este cliente");
    const created = await transaction.user.create({ data: { id, username, displayName: typedText(payload, "displayName", username) ?? username, email, passwordHash: await hash(typedText(payload, "password", "ChangeMe123!") ?? "ChangeMe123!", 10), clientId: session.client.id, active: typedText(payload, "active", "Sí") !== "No" } });
    await transaction.userInstallation.create({ data: { userId: created.id, installationId: installation.id, roleId: role.id } });
    record = { id: created.id, username: created.username, displayName: created.displayName, email: created.email, active: created.active ? "Sí" : "No", role: role.name, roleKey: role.key, installation: installation.code };
  }
  else if (resource === "roles") {
    const created = await transaction.role.create({ data: { id, key: reference, name: typedText(payload, "name", reference) ?? reference } });
    const permissionKeys = Array.isArray(payload.permissionKeys) ? payload.permissionKeys.map(String).filter(Boolean) : [];
    if (permissionKeys.length > 0) {
      const permissions = await transaction.permission.findMany({ where: { key: { in: permissionKeys } }, select: { id: true } });
      await transaction.rolePermission.createMany({ data: permissions.map((permission) => ({ roleId: created.id, permissionId: permission.id })), skipDuplicates: true });
    }
    record = { id: created.id, key: created.key, name: created.name, permissions: permissionKeys.join(", ") };
  }
  else if (resource === "integrations") record = await transaction.integration.create({ data: { id, installationId: session.installation.id, code: reference, name: typedText(payload, "name", "Integración nueva") ?? "Integración nueva", type: typedText(payload, "type"), protocol: typedText(payload, "protocol", "REST") ?? "REST", endpoint: typedText(payload, "endpoint"), direction: typedText(payload, "direction"), installationCode: session.installation.code, frequency: typedText(payload, "frequency"), status: typedText(payload, "status", "Programada") ?? "Programada", lastExecution: typedDate(payload, "lastExecution"), nextExecution: typedDate(payload, "nextExecution"), latencyMs: typedInteger(payload, "latencyMs"), processed: typedInteger(payload, "processed"), failed: typedInteger(payload, "failed"), retryPolicy: typedText(payload, "retryPolicy"), version: typedText(payload, "version"), lastError: typedText(payload, "lastError") } }) as unknown as Record<string, unknown>;
  else record = await transaction.replenishmentTask.create({ data: { id, installationId: session.installation.id, reference, wave: typedText(payload, "wave"), sku: typedText(payload, "sku"), description: typedText(payload, "description"), sourceLocation: typedText(payload, "sourceLocation"), targetLocation: typedText(payload, "targetLocation"), current: typedInteger(payload, "current"), minimum: typedInteger(payload, "minimum"), suggested: typedInteger(payload, "suggested"), quantity: typedInteger(payload, "quantity"), unit: typedText(payload, "unit", "uds"), priority: typedText(payload, "priority", "Normal") ?? "Normal", status: typedText(payload, "status", "Pendiente") ?? "Pendiente", operator: typedText(payload, "operator", "Sin asignar"), reason: typedText(payload, "reason"), route: typedText(payload, "route"), createdAt: typedDate(payload, "createdAt") ?? new Date(), dueAt: typedDate(payload, "dueAt"), confirmedAt: typedDate(payload, "confirmedAt"), observations: typedText(payload, "observations") } }) as unknown as Record<string, unknown>;
  await transaction.auditEvent.create({ data: { clientId: session.client.id, installationId: session.installation.id, userId: session.user.id, eventType: "OPERATION", resource, action: "RECORD_CREATED", entityId: id, details: { reference, storage: "typed" } } });
  return record;
};

const updateTypedWorkspaceRecord = async (transaction: Prisma.TransactionClient, session: SessionContext, resource: string, id: string, payload: Record<string, unknown>) => {
  const status = typedText(payload, "status");
  if (resource === "receipts") { const current = await transaction.receipt.findFirst({ where: { id, installationId: session.installation.id } }); return current ? transaction.receipt.update({ where: { id }, data: { status: status ?? current.status, qualityCheck: typedText(payload, "qualityCheck") ?? current.qualityCheck, notes: typedText(payload, "notes") ?? current.notes } }) : null; }
  if (resource === "picking") { const current = await transaction.pickingTask.findFirst({ where: { id, installationId: session.installation.id } }); return current ? transaction.pickingTask.update({ where: { id }, data: { status: status ?? current.status, picker: typedText(payload, "picker") ?? current.picker, progress: Math.min(100, Math.max(0, typedInteger(payload, "progress", current.progress))), observations: typedText(payload, "observations") ?? current.observations } }) : null; }
  if (resource === "shipments") { const current = await transaction.shipment.findFirst({ where: { id, installationId: session.installation.id } }); return current ? transaction.shipment.update({ where: { id }, data: { status: status ?? current.status, dock: typedText(payload, "dock") ?? current.dock, notes: typedText(payload, "notes") ?? current.notes } }) : null; }
  if (resource === "locations") { const current = await transaction.location.findFirst({ where: { id, installationId: session.installation.id } }); return current ? transaction.location.update({ where: { id }, data: { status: status ?? current.status, capacity: typedInteger(payload, "capacity", current.capacity), occupied: typedInteger(payload, "occupied", current.occupied), utilization: Math.min(100, Math.max(0, typedInteger(payload, "utilization", current.utilization))), updatedBy: session.user.displayName } }) : null; }
  if (resource === "inventory") { const current = await transaction.inventoryCount.findFirst({ where: { id, installationId: session.installation.id } }); return current ? transaction.inventoryCount.update({ where: { id }, data: { status: status ?? current.status, counted: typedInteger(payload, "counted", current.counted), difference: typedInteger(payload, "difference", current.difference), counter: typedText(payload, "counter") ?? current.counter, notes: typedText(payload, "notes") ?? current.notes } }) : null; }
  if (resource === "products") { const current = await transaction.product.findFirst({ where: { id, installationId: session.installation.id } }); return current ? transaction.product.update({ where: { id }, data: { status: status ?? current.status, active: typedText(payload, "active") ?? current.active, description: typedText(payload, "description") ?? current.description, updatedBy: session.user.displayName } }) : null; }
  if (resource === "suppliers") { const current = await transaction.supplier.findFirst({ where: { id, installationId: session.installation.id } }); return current ? transaction.supplier.update({ where: { id }, data: { status: status ?? current.status, active: typedText(payload, "active") ?? current.active, name: typedText(payload, "name") ?? current.name, email: typedText(payload, "email") ?? current.email } }) : null; }
  if (resource === "customers") { const current = await transaction.customer.findFirst({ where: { id, installationId: session.installation.id } }); return current ? transaction.customer.update({ where: { id }, data: { status: status ?? current.status, active: typedText(payload, "active") ?? current.active, name: typedText(payload, "name") ?? current.name, email: typedText(payload, "email") ?? current.email } }) : null; }
  if (resource === "movements") { const current = await transaction.movementRecord.findFirst({ where: { id, installationId: session.installation.id } }); return current ? transaction.movementRecord.update({ where: { id }, data: { status: status ?? current.status, observations: typedText(payload, "observations") ?? current.observations, confirmedAt: status === "Confirmado" ? new Date() : current.confirmedAt } }) : null; }
  if (resource === "queries") { const current = await transaction.savedQuery.findFirst({ where: { id, installationId: session.installation.id } }); return current ? transaction.savedQuery.update({ where: { id }, data: { status: status ?? current.status, name: typedText(payload, "name") ?? current.name, owner: typedText(payload, "owner") ?? current.owner } }) : null; }
  if (resource === "users") {
    const current = await transaction.user.findFirst({ where: { id, clientId: session.client.id }, include: { assignments: { include: { role: true, installation: true } } } });
    if (!current) return null;
    const password = typedText(payload, "password");
    const currentAssignment = current.assignments[0];
    const roleKey = typedText(payload, "roleKey", currentAssignment?.role.key ?? "WAREHOUSE_MANAGER") ?? "WAREHOUSE_MANAGER";
    const installationCode = typedText(payload, "installationCode", currentAssignment?.installation.code ?? session.installation.code) ?? session.installation.code;
    const [role, installation] = await Promise.all([
      transaction.role.findUnique({ where: { key: roleKey } }),
      transaction.installation.findFirst({ where: { clientId: session.client.id, code: installationCode } }),
    ]);
    if (!role || !installation) throw new Error("El rol o la instalación indicada no existe para este cliente");
    await transaction.user.update({ where: { id }, data: { displayName: typedText(payload, "displayName") ?? current.displayName, email: typedText(payload, "email") ?? current.email, active: typedText(payload, "active") ? typedText(payload, "active") !== "No" : current.active, ...(password ? { passwordHash: await hash(password, 10) } : {}) } });
    await transaction.userInstallation.upsert({ where: { userId_installationId: { userId: id, installationId: installation.id } }, update: { roleId: role.id }, create: { userId: id, installationId: installation.id, roleId: role.id } });
    const updated = await transaction.user.findUniqueOrThrow({ where: { id }, include: { assignments: { include: { role: true, installation: true } } } });
    return serializeAdminUser(updated);
  }
  if (resource === "roles") {
    const current = await transaction.role.findUnique({ where: { id }, include: { permissions: { include: { permission: true } } } });
    if (!current) return null;
    const permissionKeys = Array.isArray(payload.permissionKeys) ? payload.permissionKeys.map(String).filter(Boolean) : null;
    const updated = await transaction.role.update({ where: { id }, data: { name: typedText(payload, "name") ?? current.name } });
    if (permissionKeys) {
      const permissions = await transaction.permission.findMany({ where: { key: { in: permissionKeys } }, select: { id: true } });
      await transaction.rolePermission.deleteMany({ where: { roleId: id } });
      await transaction.rolePermission.createMany({ data: permissions.map((permission) => ({ roleId: id, permissionId: permission.id })), skipDuplicates: true });
    }
    const hydrated = await transaction.role.findUniqueOrThrow({ where: { id: updated.id }, include: { permissions: { include: { permission: true } } } });
    return serializeRole(hydrated);
  }
  if (resource === "integrations") { const current = await transaction.integration.findFirst({ where: { id, installationId: session.installation.id } }); return current ? transaction.integration.update({ where: { id }, data: { status: status ?? current.status, endpoint: typedText(payload, "endpoint") ?? current.endpoint, lastError: typedText(payload, "lastError") ?? current.lastError } }) : null; }
  const current = await transaction.replenishmentTask.findFirst({ where: { id, installationId: session.installation.id } });
  return current ? transaction.replenishmentTask.update({ where: { id }, data: { status: status ?? current.status, operator: typedText(payload, "operator") ?? current.operator, quantity: typedInteger(payload, "quantity", current.quantity), observations: typedText(payload, "observations") ?? current.observations } }) : null;
};

app.post("/api/workspace/:resource", requireSession, async (request, response) => {
  const resource = getRouteResource(request.params.resource);
  if (!workspaceResources.has(resource as WorkspaceResource) || !storedWorkspaceResources.has(resource)) return response.status(404).json({ message: "Este módulo no admite altas en esta versión" });
  const session = response.locals.session as SessionContext;
  if (!canAccessWorkspaceResource(resource, session)) return response.status(403).json({ message: "Tu rol no puede crear registros en este módulo" });
  const parsed = parseWorkspaceRecordBody(request.body as Record<string, unknown>);
  if (parsed.error) return response.status(400).json({ message: parsed.error });
  const reference = typeof parsed.payload.reference === "string" ? parsed.payload.reference.trim() : typeof parsed.payload.code === "string" ? parsed.payload.code.trim() : typeof parsed.payload.sku === "string" ? parsed.payload.sku.trim() : typeof parsed.payload.username === "string" ? parsed.payload.username.trim() : typeof parsed.payload.key === "string" ? parsed.payload.key.trim() : "";
  if (!reference) return response.status(400).json({ message: "El registro necesita una referencia o código" });
  const id = `${resource}-${randomBytes(8).toString("hex")}`;
  const payload: Record<string, unknown> = { ...parsed.payload, id };
  const record = await prisma.$transaction(async (transaction) => {
    if (typedWorkspaceResources.has(resource)) return createTypedWorkspaceRecord(transaction, session, resource, id, payload, reference);
    const created = await transaction.workspaceRecord.create({ data: { id, installationId: session.installation.id, resource, reference, status: typeof payload.status === "string" ? payload.status : null, payload: payload as Prisma.InputJsonValue, source: "API" } });
    await transaction.auditEvent.create({ data: { clientId: session.client.id, installationId: session.installation.id, userId: session.user.id, eventType: "OPERATION", resource, action: "RECORD_CREATED", entityId: id, details: { reference } } });
    return created;
  });
  return response.status(201).json(typedWorkspaceResources.has(resource) ? serializePrismaWorkspaceRow(record as Record<string, unknown>) : serializeWorkspaceRecord(record as { id: string; payload: unknown }));
});

app.patch("/api/workspace/:resource/:id", requireSession, async (request, response) => {
  const resource = getRouteResource(request.params.resource);
  const id = getRouteResource(request.params.id);
  if (!workspaceResources.has(resource as WorkspaceResource) || !storedWorkspaceResources.has(resource)) return response.status(404).json({ message: "Este módulo no admite edición en esta versión" });
  const session = response.locals.session as SessionContext;
  if (!canAccessWorkspaceResource(resource, session)) return response.status(403).json({ message: "Tu rol no puede editar registros en este módulo" });
  const parsed = parseWorkspaceRecordBody(request.body as Record<string, unknown>);
  if (parsed.error) return response.status(400).json({ message: parsed.error });
  if (typedWorkspaceResources.has(resource)) {
    const updated = await prisma.$transaction(async (transaction) => {
      const saved = await updateTypedWorkspaceRecord(transaction, session, resource, id, parsed.payload);
      if (!saved) return null;
      await transaction.auditEvent.create({ data: { clientId: session.client.id, installationId: session.installation.id, userId: session.user.id, eventType: "OPERATION", resource, action: "RECORD_UPDATED", entityId: id, details: { changedFields: Object.keys(parsed.payload), storage: "typed" } } });
      return saved;
    });
    if (!updated) return response.status(404).json({ message: "Registro no encontrado" });
    return response.json(serializePrismaWorkspaceRow(updated as unknown as Record<string, unknown>));
  }
  const current = await prisma.workspaceRecord.findFirst({ where: { id, resource, installationId: session.installation.id } });
  if (!current) return response.status(404).json({ message: "Registro no encontrado" });
  const payload: Record<string, unknown> = { ...(current.payload && typeof current.payload === "object" ? current.payload as Record<string, unknown> : {}), ...parsed.payload, id };
  const updated = await prisma.$transaction(async (transaction) => {
    const saved = await transaction.workspaceRecord.update({ where: { id }, data: { payload: payload as Prisma.InputJsonValue, reference: typeof payload.reference === "string" ? payload.reference : current.reference, status: typeof payload.status === "string" ? payload.status : current.status } });
    await transaction.auditEvent.create({ data: { clientId: session.client.id, installationId: session.installation.id, userId: session.user.id, eventType: "OPERATION", resource, action: "RECORD_UPDATED", entityId: id, details: { changedFields: Object.keys(parsed.payload) } } });
    return saved;
  });
  return response.json(serializeWorkspaceRecord(updated));
});

const serializeStockItem = (item: {
  id: string;
  sku: string;
  description: string;
  lot: string;
  serialNumber: string | null;
  warehouse: string;
  zone: string;
  aisle: string;
  bay: string;
  level: string;
  position: string;
  status: string;
  quantity: number;
  available: number;
  reserved: number;
  minimum: number;
  unit: string;
  expiry: string | null;
  lastMovement: Date;
  supplier: string;
  owner: string;
  updatedBy: string;
}) => ({
  id: item.id,
  sku: item.sku,
  description: item.description,
  lot: item.lot,
  serialNumber: item.serialNumber,
  warehouse: item.warehouse,
  zone: item.zone,
  aisle: item.aisle,
  bay: item.bay,
  level: item.level,
  position: item.position,
  status: item.status,
  quantity: item.quantity,
  available: item.available,
  reserved: item.reserved,
  minimum: item.minimum,
  unit: item.unit,
  expiry: item.expiry,
  lastMovement: item.lastMovement.toISOString(),
  supplier: item.supplier,
  owner: item.owner,
  updatedBy: item.updatedBy,
});

app.post("/api/stock/movements", requireSession, async (request, response) => {
  const session = response.locals.session as SessionContext;
  if (!hasPermission(session, "workspace.operate")) return response.status(403).json({ message: "Tu rol no puede registrar movimientos de stock" });

  const body = request.body as Record<string, unknown>;
  const sku = typeof body.sku === "string" ? body.sku.trim() : "";
  const lot = typeof body.lot === "string" ? body.lot.trim() : "";
  const type = body.type === "IN" || body.type === "OUT" ? body.type : null;
  const quantity = Number(body.quantity);
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (!sku || !type || !Number.isInteger(quantity) || quantity <= 0 || quantity > 1000000 || !reason) {
    return response.status(400).json({ message: "SKU, tipo, cantidad positiva y motivo son obligatorios" });
  }

  const item = await prisma.stockItem.findFirst({ where: { installationId: session.installation.id, sku, ...(lot ? { lot } : {}) } });
  if (!item) return response.status(404).json({ message: "No se encontró el artículo en esta instalación" });
  const delta = type === "IN" ? quantity : -quantity;
  if (item.available + delta < 0 || item.quantity + delta < 0) return response.status(409).json({ message: "La salida supera las existencias disponibles" });

  const result = await prisma.$transaction(async (transaction) => {
    const updated = await transaction.stockItem.update({ where: { id: item.id }, data: { quantity: { increment: delta }, available: { increment: delta }, lastMovement: new Date(), updatedBy: session.user.displayName } });
    const movement = await transaction.stockMovement.create({ data: { installationId: session.installation.id, stockItemId: item.id, userId: session.user.id, type, quantity, reason, origin: typeof body.origin === "string" ? body.origin.trim() || null : null, destination: typeof body.destination === "string" ? body.destination.trim() || null : null, sourceDocument: typeof body.sourceDocument === "string" ? body.sourceDocument.trim() || null : null } });
    await transaction.auditEvent.create({ data: { clientId: session.client.id, installationId: session.installation.id, userId: session.user.id, eventType: "OPERATION", resource: "stock", action: "STOCK_MOVEMENT", entityId: movement.id, details: { sku: item.sku, lot: item.lot, type, quantity, reason } } });
    return { updated, movement };
  });

  return response.status(201).json({ movement: result.movement, stock: serializeStockItem(result.updated) });
});

const serializeAuditEvent = (event: { id: string; eventType: string; resource: string; action: string; entityId: string | null; details: unknown; outcome: string; ipAddress: string | null; createdAt: Date; userId: string | null }, installation: string) => ({
  id: event.id,
  eventId: event.id,
  occurredAt: event.createdAt.toISOString(),
  actor: event.userId ?? "Sistema",
  role: "",
  module: event.resource,
  action: event.action,
  entity: event.entityId ?? "—",
  entityId: event.entityId,
  installation,
  warehouse: "—",
  outcome: event.outcome === "SUCCESS" ? "Correcto" : event.outcome,
  ip: event.ipAddress ?? "—",
  correlationId: "—",
  durationMs: 0,
  details: event.details ? JSON.stringify(event.details) : event.eventType,
  userAgent: "API",
});

type SerializedWorkspaceRow = Record<string, string | number | null> & { id: string };

const serializePrismaWorkspaceRow = (row: Record<string, unknown>): SerializedWorkspaceRow => {
  const serialized = Object.fromEntries(Object.entries(row).filter(([key]) => !["installationId", "updatedAt"].includes(key)).map(([key, value]) => [key, value instanceof Date ? value.toISOString() : value === undefined ? null : value])) as SerializedWorkspaceRow;
  return { ...serialized, id: String(serialized.id) };
};

const serializeAdminUser = (row: Record<string, unknown>) => {
  const assignments = Array.isArray(row.assignments) ? row.assignments as Array<{ role?: { key?: string; name?: string }; installation?: { code?: string } }> : [];
  return {
  id: String(row.id ?? ""),
  username: String(row.username ?? ""),
  displayName: String(row.displayName ?? ""),
  email: String(row.email ?? ""),
  active: row.active ? "Sí" : "No",
  role: assignments[0]?.role?.name ?? "Sin rol",
  roleKey: assignments[0]?.role?.key ?? null,
  installation: assignments[0]?.installation?.code ?? "—",
  };
};

const serializeRole = (row: Record<string, unknown>) => {
  const permissions = Array.isArray(row.permissions) ? row.permissions as Array<{ permission?: { key?: string } }> : [];
  return {
    id: String(row.id ?? ""),
    key: String(row.key ?? ""),
    name: String(row.name ?? ""),
    permissions: permissions.map(({ permission }) => permission?.key).filter(Boolean).join(", "),
    permissionCount: permissions.length,
  };
};

const getTypedWorkspaceRows = async (resource: string, installationId: string) => {
  const rows = await workspaceRepository.findTypedRows(resource, installationId);
  if (resource === "users") return rows.map(serializeAdminUser);
  if (resource === "roles") return rows.map(serializeRole);
  return rows.map((row) => {
    const shaped = resource === "picking" ? { ...row, order: row.orderNumber, progress: `${row.progress}%` } :
      resource === "shipments" ? { ...row, order: row.orderNumber } :
        resource === "locations" ? { ...row, utilization: `${row.utilization}%` } :
          resource === "integrations" ? { ...row, installation: row.installationCode } : row;
    return serializePrismaWorkspaceRow(shaped);
  });
};

app.get("/api/workspace/:resource", requireSession, async (request, response) => {
  const resource = request.params.resource as WorkspaceResource;
  if (!workspaceResources.has(resource)) return response.status(404).json({ message: "Módulo no encontrado" });

  const session = response.locals.session as SessionContext;
  if (["installations", "users", "roles"].includes(resource) && !requirePermission(session, "users.manage")) return response.status(403).json({ message: "Tu rol no puede consultar este módulo" });
  if (resource === "integrations" && !requirePermission(session, "integrations.execute")) return response.status(403).json({ message: "Tu rol no puede consultar este módulo" });

  const auditRows = resource === "audit" ? await prisma.auditEvent.findMany({ where: { installationId: session.installation.id }, orderBy: { createdAt: "desc" }, take: 500 }) : [];
  const installationRows = resource === "installations" ? await prisma.installation.findMany({ where: { clientId: session.client.id }, orderBy: { code: "asc" }, include: { _count: { select: { warehouses: true, assignments: true } } } }) : [];
  const typedRows = typedWorkspaceResources.has(resource) ? await getTypedWorkspaceRows(resource, session.installation.id) : [];
  const storedRows = storedWorkspaceResources.has(resource) && !typedWorkspaceResources.has(resource) ? await prisma.workspaceRecord.findMany({ where: { installationId: session.installation.id, resource }, orderBy: { updatedAt: "desc" } }) : [];
  const queryConfiguration = configurableQueryResources.has(resource) ? await prisma.queryConfiguration.findUnique({ where: { installationId_resource: { installationId: session.installation.id, resource } } }) : null;
  let allRows: SerializedWorkspaceRow[];
  if (resource === "stock" && queryConfiguration?.status === "PUBLISHED") {
    try {
      allRows = await executeConfiguredStockQuery(session, queryConfiguration.sqlText);
    } catch (error) {
      console.error("No se pudo ejecutar la consulta publicada de Stock", error);
      return response.status(422).json({ message: "La consulta publicada de Stock no se puede ejecutar. Revisa su SQL y parámetros." });
    }
  } else if (resource !== "stock" && queryConfiguration?.status === "PUBLISHED") {
    try {
      allRows = await executeConfiguredWorkspaceQuery(session, resource, queryConfiguration.sqlText);
    } catch (error) {
      console.error(`No se pudo ejecutar la consulta publicada de ${resource}`, error);
      return response.status(422).json({ message: `La consulta publicada de ${resource} no se puede ejecutar. Revisa su SQL y parámetros.` });
    }
  } else if (resource === "stock") {
    allRows = (await prisma.stockItem.findMany({ where: { installationId: session.installation.id }, orderBy: { sku: "asc" } })).map(serializeStockItem);
  } else if (resource === "audit" && auditRows.length > 0) {
    allRows = auditRows.map((event) => serializeAuditEvent(event, session.installation.code));
  } else if (resource === "installations") {
    allRows = installationRows.map(serializeInstallation);
  } else if (typedWorkspaceResources.has(resource)) {
    allRows = typedRows;
  } else if (storedRows.length > 0) {
    allRows = storedRows.map(serializeWorkspaceRecord);
  } else {
    allRows = getWorkspaceRows(resource);
  }
  const search = String(request.query.search ?? "").trim().toLowerCase();
  const status = String(request.query.status ?? "all");
  const page = Math.max(1, Number(request.query.page ?? 1));
  const pageSize = Math.min(100, Math.max(10, Number(request.query.pageSize ?? 35)));
  const sortBy = String(request.query.sortBy ?? "");
  const sortDir = request.query.sortDir === "desc" ? -1 : 1;

  const filteredRows = allRows.filter((row) => {
    const matchesSearch = !search || Object.values(row).some((value) => String(value ?? "").toLowerCase().includes(search));
    const matchesStatus = status === "all" || String(row.status ?? "") === status;
    return matchesSearch && matchesStatus;
  });

  if (sortBy) {
    filteredRows.sort((left, right) => String(left[sortBy] ?? "").localeCompare(String(right[sortBy] ?? ""), "es", { numeric: true }) * sortDir);
  }

  const total = filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  return response.json({ resource, items: filteredRows.slice(start, start + pageSize), total, page: safePage, pageSize, totalPages, generatedRows: allRows.length, availableStatuses: Array.from(new Set(allRows.map((row) => String((row as Record<string, unknown>).status ?? "")).filter(Boolean))) });
});

const server = process.env.NODE_ENV === "test" ? null : app.listen(port, () => console.log(`Almacén SGA API escuchando en el puerto ${port}`));

const shutdown = async () => {
  server?.close();
  await prisma.$disconnect();
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

export { app, prisma };
