import { afterAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app, prisma } from "./server.js";

describe("autenticación SGA", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("expone el estado de la API y PostgreSQL", async () => {
    const response = await request(app).get("/api/health");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ status: "ok", database: "connected" });
  });

  it("rechaza credenciales inválidas sin crear sesión", async () => {
    const response = await request(app).post("/api/auth/login").send({ username: "jgarcia", password: "incorrecta" });

    expect(response.status).toBe(401);
    expect(response.body.message).toBe("Usuario o contraseña incorrectos");
  });

  it("guarda el límite de intentos de login en PostgreSQL", async () => {
    const username = `missing-${Date.now()}`;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const response = await request(app).post("/api/auth/login").send({ username, password: "incorrecta" });
      expect(response.status).toBe(401);
    }
    const blocked = await request(app).post("/api/auth/login").send({ username, password: "incorrecta" });
    expect(blocked.status).toBe(429);
    await prisma.rateLimitBucket.deleteMany({ where: { key: { contains: username } } });
  });

  it("permite login, consulta la sesión, accede al dashboard y cierra sesión", async () => {
    const login = await request(app).post("/api/auth/login").send({ username: "jgarcia", password: "demo123" });

    expect(login.status).toBe(200);
    expect(login.body).toMatchObject({
      user: { username: "jgarcia" },
      client: { code: "NORTELOG" },
      installation: { code: "MADRID01" },
    });
    expect(login.body.token).toEqual(expect.any(String));

    const token = login.body.token as string;
    const me = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);
    expect(me.status).toBe(200);
    expect(me.body.sessionId).toBe(login.body.sessionId);

    const dashboard = await request(app).get("/api/dashboard").set("Authorization", `Bearer ${token}`);
    expect(dashboard.status).toBe(200);
    expect(dashboard.body.installation).toBe(login.body.installation.name);
    expect(dashboard.body.metrics).toMatchObject({ stock: expect.any(Number), pendingReceipts: expect.any(Number), pickingTasks: expect.any(Number), shipmentsToday: expect.any(Number) });

    const metrics = await request(app).get("/api/metrics").set("Authorization", `Bearer ${token}`);
    expect(metrics.status).toBe(200);
    expect(metrics.body.routes["GET /api/dashboard"]).toMatchObject({ count: expect.any(Number), averageMs: expect.any(Number) });

    const logout = await request(app).post("/api/auth/logout").set("Authorization", `Bearer ${token}`);
    expect(logout.status).toBe(204);

    const expired = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);
    expect(expired.status).toBe(401);
  });

  it("aplica permisos: el gerente opera almacén pero no administra instalaciones", async () => {
    const login = await request(app).post("/api/auth/login").send({ username: "jgarcia", password: "demo123" });
    const token = login.body.token as string;

    expect(login.body.role).toMatchObject({ key: "WAREHOUSE_MANAGER" });

    const stock = await request(app).get("/api/workspace/stock?page=1&pageSize=50&search=SKU-1000").set("Authorization", `Bearer ${token}`);
    expect(stock.status).toBe(200);
    expect(stock.body).toMatchObject({ resource: "stock", page: 1, pageSize: 50 });
    expect(stock.body.generatedRows).toBeGreaterThan(3000);
    expect(stock.body.items.length).toBeGreaterThan(0);

    for (const resource of ["locations", "movements", "inventory", "queries", "products", "replenishment", "suppliers", "customers", "audit"]) {
      const moduleResponse = await request(app).get(`/api/workspace/${resource}?pageSize=25`).set("Authorization", `Bearer ${token}`);
      expect(moduleResponse.status).toBe(200);
      expect(moduleResponse.body.generatedRows).toBeGreaterThan(0);
    }

    const installations = await request(app).get("/api/workspace/installations").set("Authorization", `Bearer ${token}`);
    expect(installations.status).toBe(403);
  });

  it("permite a Developer consultar configuración, integraciones y roles", async () => {
    const login = await request(app).post("/api/auth/login").send({ username: "adev", password: "demo123" });
    const token = login.body.token as string;

    expect(login.body.role).toMatchObject({ key: "DEVELOPER" });
    const installations = await request(app).get("/api/workspace/installations?pageSize=25").set("Authorization", `Bearer ${token}`);
    expect(installations.status).toBe(200);
    expect(installations.body.total).toBeGreaterThanOrEqual(24);
    expect(installations.body.items).toHaveLength(24);

    const installation = installations.body.items[0] as { id: string; name: string; code: string };
    const updatedInstallation = await request(app).put(`/api/installations/${installation.id}`).set("Authorization", `Bearer ${token}`).send({
      code: installation.code,
      name: `Centro editado ${Date.now()}`,
      city: "Madrid",
      timezone: "Europe/Madrid",
      environment: "Producción",
      version: "0.2.0",
      status: "Activa",
      manager: "Ana Developer",
    });
    expect(updatedInstallation.status).toBe(200);
    expect(updatedInstallation.body).toMatchObject({ id: installation.id, version: "0.2.0", manager: "Ana Developer" });
    const installationAudit = await prisma.auditEvent.findFirst({ where: { entityId: installation.id, action: "INSTALLATION_UPDATED" }, orderBy: { createdAt: "desc" } });
    expect(installationAudit).toMatchObject({ resource: "installations", eventType: "CONFIGURATION" });

    const users = await request(app).get("/api/workspace/users?pageSize=25").set("Authorization", `Bearer ${token}`);
    expect(users.status).toBe(200);
    expect(users.body.total).toBeGreaterThanOrEqual(48);

    for (const resource of ["roles", "integrations"]) {
      const moduleResponse = await request(app).get(`/api/workspace/${resource}?pageSize=25`).set("Authorization", `Bearer ${token}`);
      expect(moduleResponse.status).toBe(200);
      expect(moduleResponse.body.generatedRows).toBeGreaterThan(0);
    }
    const integrationRun = await request(app).post("/api/integrations/integration-1/run").set("Authorization", `Bearer ${token}`);
    expect(integrationRun.status).toBe(200);
    expect(integrationRun.body).toMatchObject({ id: "integration-1", status: "Operativa" });
    expect(await prisma.integration.findUnique({ where: { id: "integration-1" } })).toMatchObject({ status: "Operativa", lastError: null });

    const managerLogin = await request(app).post("/api/auth/login").send({ username: "jgarcia", password: "demo123" });
    const managerToken = managerLogin.body.token as string;
    const rolesForManager = await request(app).get("/api/workspace/roles").set("Authorization", `Bearer ${managerToken}`);
    expect(rolesForManager.status).toBe(403);
    const installationUpdateForManager = await request(app).put(`/api/installations/${installation.id}`).set("Authorization", `Bearer ${managerToken}`).send({ code: installation.code, name: installation.name });
    expect(installationUpdateForManager.status).toBe(403);
  });

  it("registra movimientos de stock de forma transaccional y deja auditoría", async () => {
    const login = await request(app).post("/api/auth/login").send({ username: "jgarcia", password: "demo123" });
    const token = login.body.token as string;
    const beforeResponse = await request(app).get("/api/workspace/stock?pageSize=10&search=SKU-1000").set("Authorization", `Bearer ${token}`);
    const before = beforeResponse.body.items[0] as { sku: string; lot: string; available: number };
    expect(beforeResponse.status).toBe(200);

    const movement = await request(app).post("/api/stock/movements").set("Authorization", `Bearer ${token}`).send({ sku: before.sku, lot: before.lot, type: "IN", quantity: 7, reason: "Prueba de recepción", destination: "A-01-01-01", sourceDocument: "TEST-001" });
    expect(movement.status).toBe(201);
    expect(movement.body.stock).toMatchObject({ sku: before.sku, available: before.available + 7 });

    const audit = await request(app).get("/api/workspace/audit?pageSize=25&search=STOCK_MOVEMENT").set("Authorization", `Bearer ${token}`);
    expect(audit.status).toBe(200);
    expect(audit.body.items).toEqual(expect.arrayContaining([expect.objectContaining({ action: "STOCK_MOVEMENT", outcome: "Correcto" })]));

    const excessiveExit = await request(app).post("/api/stock/movements").set("Authorization", `Bearer ${token}`).send({ sku: before.sku, lot: before.lot, type: "OUT", quantity: 9999999, reason: "Salida inválida" });
    expect(excessiveExit.status).toBe(400);
  });

  it("configura y publica la consulta de Stock por instalación con permisos separados", async () => {
    const developerLogin = await request(app).post("/api/auth/login").send({ username: "adev", password: "demo123" });
    const developerToken = developerLogin.body.token as string;
    const configurationResponse = await request(app).get("/api/query-configurations/stock").set("Authorization", `Bearer ${developerToken}`);

    expect(configurationResponse.status).toBe(200);
    expect(configurationResponse.body).toMatchObject({ resource: "stock", installation: configurationResponse.body.installationId, status: "PUBLISHED" });
    expect(configurationResponse.body.columns).toEqual(expect.arrayContaining([expect.objectContaining({ key: "sku" })]));
    expect(configurationResponse.body.parameters).toContain("installationId");
    expect(configurationResponse.body.columns.find((column: { key: string }) => column.key === "status")).toMatchObject({ type: "status", badge: true });

    const original = configurationResponse.body;
    const unsafeSql = await request(app).put("/api/query-configurations/stock").set("Authorization", `Bearer ${developerToken}`).send({ name: "Insegura", sqlText: "DELETE FROM stock" });
    expect(unsafeSql.status).toBe(400);
    const draft = await request(app).put("/api/query-configurations/stock").set("Authorization", `Bearer ${developerToken}`).send({
      name: `${original.name} · prueba`,
      description: original.description,
      sqlText: original.sqlText,
      columns: original.columns,
      filters: original.filters,
      parameters: original.parameters,
      defaultSort: original.defaultSort,
      actions: original.actions,
      allowedRoles: original.allowedRoles,
    });
    expect(draft.status).toBe(200);
    expect(draft.body.status).toBe("DRAFT");
    expect(draft.body.version).toBeGreaterThan(original.version);

    const published = await request(app).post("/api/query-configurations/stock/publish").set("Authorization", `Bearer ${developerToken}`);
    expect(published.status).toBe(200);
    expect(published.body.status).toBe("PUBLISHED");

    const history = await request(app).get("/api/query-configurations/stock/versions").set("Authorization", `Bearer ${developerToken}`);
    expect(history.status).toBe(200);
    expect(history.body.versions.length).toBeGreaterThan(0);
    const rollbackVersion = history.body.versions[history.body.versions.length - 1].version as number;
    const rollback = await request(app).post(`/api/query-configurations/stock/versions/${rollbackVersion}/rollback`).set("Authorization", `Bearer ${developerToken}`);
    expect(rollback.status).toBe(200);
    expect(rollback.body.status).toBe("DRAFT");

    const managerLogin = await request(app).post("/api/auth/login").send({ username: "jgarcia", password: "demo123" });
    const managerToken = managerLogin.body.token as string;
    const managerConfiguration = await request(app).get("/api/query-configurations/stock").set("Authorization", `Bearer ${managerToken}`);
    expect(managerConfiguration.status).toBe(200);
    const managerUpdate = await request(app).put("/api/query-configurations/stock").set("Authorization", `Bearer ${managerToken}`).send({ name: "No permitido", sqlText: original.sqlText });
    expect(managerUpdate.status).toBe(403);

    await request(app).put("/api/query-configurations/stock").set("Authorization", `Bearer ${developerToken}`).send({
      name: original.name,
      description: original.description,
      sqlText: original.sqlText,
      columns: original.columns,
      filters: original.filters,
      parameters: original.parameters,
      defaultSort: original.defaultSort,
      actions: original.actions,
      allowedRoles: original.allowedRoles,
    });
    await request(app).post("/api/query-configurations/stock/publish").set("Authorization", `Bearer ${developerToken}`);

    const customQuery = await request(app).put("/api/query-configurations/stock").set("Authorization", `Bearer ${developerToken}`).send({
      name: "Stock reducido",
      description: "Prueba de consulta publicada.",
      sqlText: "SELECT sku, available, status FROM stock WHERE installation_id = :installationId ORDER BY sku ASC LIMIT 2",
      columns: [
        { key: "sku", label: "SKU", visible: true, type: "text" },
        { key: "available", label: "Disponible", visible: true, type: "number" },
        { key: "status", label: "Estado", visible: true, type: "status", badge: true },
      ],
      filters: [],
      parameters: ["installationId"],
      defaultSort: "sku asc",
      actions: ["Exportar"],
      allowedRoles: ["WAREHOUSE_MANAGER", "DEVELOPER", "PRODUCT_OWNER"],
    });
    expect(customQuery.status).toBe(200);
    const customPublished = await request(app).post("/api/query-configurations/stock/publish").set("Authorization", `Bearer ${developerToken}`);
    expect(customPublished.status).toBe(200);
    const configuredRows = await request(app).get("/api/workspace/stock?pageSize=10").set("Authorization", `Bearer ${developerToken}`);
    expect(configuredRows.status).toBe(200);
    expect(configuredRows.body.generatedRows).toBe(2);
    expect(configuredRows.body.items[0]).toEqual(expect.objectContaining({ sku: expect.any(String), available: expect.any(Number) }));
    expect(configuredRows.body.items[0].description).toBeUndefined();

    await request(app).put("/api/query-configurations/stock").set("Authorization", `Bearer ${developerToken}`).send({
      name: original.name,
      description: original.description,
      sqlText: original.sqlText,
      columns: original.columns,
      filters: original.filters,
      parameters: original.parameters,
      defaultSort: original.defaultSort,
      actions: original.actions,
      allowedRoles: original.allowedRoles,
    });
    await request(app).post("/api/query-configurations/stock/publish").set("Authorization", `Bearer ${developerToken}`);
  });

  it("permite activar, desactivar y añadir acciones custom por página", async () => {
    const developerLogin = await request(app).post("/api/auth/login").send({ username: "adev", password: "demo123" });
    const developerToken = developerLogin.body.token as string;
    const initial = await request(app).get("/api/page-actions/stock").set("Authorization", `Bearer ${developerToken}`);
    expect(initial.status).toBe(200);
    expect(initial.body.actions).toEqual(expect.any(Array));

    const managerLogin = await request(app).post("/api/auth/login").send({ username: "jgarcia", password: "demo123" });
    const managerToken = managerLogin.body.token as string;
    const managerUpdate = await request(app).put("/api/page-actions/stock").set("Authorization", `Bearer ${managerToken}`).send({ actions: [] });
    expect(managerUpdate.status).toBe(403);

    const saved = await request(app).put("/api/page-actions/stock").set("Authorization", `Bearer ${developerToken}`).send({ actions: [
      { id: "new-stock-movement", label: "Nuevo movimiento", kind: "defined", actionType: "operation", enabled: false, variant: "primary", roleKeys: ["WAREHOUSE_MANAGER"] },
      { id: "custom-cycle-count", label: "Lanzar conteo cíclico", kind: "custom", actionType: "custom", enabled: true, variant: "secondary", roleKeys: ["WAREHOUSE_MANAGER", "DEVELOPER"] },
    ] });
    expect(saved.status).toBe(200);
    expect(saved.body.version).toBeGreaterThan(0);
    expect(saved.body.actions).toEqual(expect.arrayContaining([expect.objectContaining({ id: "new-stock-movement", enabled: false }), expect.objectContaining({ id: "custom-cycle-count", kind: "custom" })]));

    const managerView = await request(app).get("/api/page-actions/stock").set("Authorization", `Bearer ${managerToken}`);
    expect(managerView.status).toBe(200);
    expect(managerView.body.actions).toHaveLength(2);

    if (initial.body.id) {
      await request(app).put("/api/page-actions/stock").set("Authorization", `Bearer ${developerToken}`).send({ actions: initial.body.actions });
    } else {
      await prisma.pageActionConfiguration.deleteMany({ where: { installationId: developerLogin.body.installation.id, resource: "stock" } });
    }
  });

  it("guarda registros operativos y ejecuta herramientas con auditoría", async () => {
    const login = await request(app).post("/api/auth/login").send({ username: "adev", password: "demo123" });
    const token = login.body.token as string;

    const reference = `RC-TEST-STORED-${Date.now()}`;
    const created = await request(app).post("/api/workspace/receipts").set("Authorization", `Bearer ${token}`).send({ payload: { reference, supplier: "Proveedor de pruebas", status: "Pendiente" } });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ reference, status: "Pendiente" });

    const sql = await request(app).post("/api/tools/sql/execute").set("Authorization", `Bearer ${token}`).send({ resource: "receipts", sqlText: "SELECT * FROM receipts WHERE installation_id = :installationId LIMIT 2" });
    expect(sql.status).toBe(200);
    expect(sql.body.rowCount).toBeGreaterThan(0);

    const xml = await request(app).post("/api/tools/xml/import").set("Authorization", `Bearer ${token}`).send({ xml: `<recepcion referencia="RC-TEST-XML-${Date.now()}"><linea sku="SKU-100001" cantidad="3" /></recepcion>` });
    expect(xml.status).toBe(201);
    expect(xml.body.lineCount).toBe(1);

    const record = await prisma.receipt.findUnique({ where: { id: created.body.id } });
    expect(record).toMatchObject({ reference, status: "Pendiente", supplier: "Proveedor de pruebas" });
    const runs = await prisma.toolRun.count({ where: { installationId: login.body.installation.id } });
    expect(runs).toBeGreaterThanOrEqual(2);
  });

  it("mantiene incrementos de stock bajo concurrencia", async () => {
    const login = await request(app).post("/api/auth/login").send({ username: "jgarcia", password: "demo123" });
    const token = login.body.token as string;
    const beforeResponse = await request(app).get("/api/workspace/stock?pageSize=10&search=SKU-100001").set("Authorization", `Bearer ${token}`);
    const before = beforeResponse.body.items[0] as { sku: string; lot: string; available: number };
    const responses = await Promise.all(Array.from({ length: 5 }, (_, index) => request(app).post("/api/stock/movements").set("Authorization", `Bearer ${token}`).send({ sku: before.sku, lot: before.lot, type: "IN", quantity: 1, reason: `Concurrencia ${index}` })));
    expect(responses.every((response) => response.status === 201)).toBe(true);
    const afterResponse = await request(app).get(`\/api\/workspace\/stock?pageSize=10&search=${before.sku}`).set("Authorization", `Bearer ${token}`);
    expect(afterResponse.body.items[0].available).toBeGreaterThanOrEqual(before.available + 5);
  });

  it("guarda los módulos operativos y administrativos en agregados tipados", async () => {
    const login = await request(app).post("/api/auth/login").send({ username: "adev", password: "demo123" });
    const token = login.body.token as string;
    const suffix = Date.now();
    const payloads: Array<{ resource: string; payload: Record<string, unknown> }> = [
      { resource: "picking", payload: { reference: `PK-TYPED-${suffix}`, status: "Pendiente", order: `PED-${suffix}` } },
      { resource: "shipments", payload: { reference: `EX-TYPED-${suffix}`, status: "Preparando", order: `PED-${suffix}` } },
      { resource: "locations", payload: { code: `UB-TYPED-${suffix}`, status: "Disponible", capacity: 100 } },
      { resource: "inventory", payload: { reference: `INV-TYPED-${suffix}`, status: "Pendiente", sku: "SKU-100001" } },
      { resource: "replenishment", payload: { reference: `REP-TYPED-${suffix}`, status: "Pendiente", sku: "SKU-100001" } },
      { resource: "products", payload: { sku: `SKU-TYPED-${suffix}`, description: "Artículo tipado de prueba", status: "Activo" } },
      { resource: "suppliers", payload: { code: `PRV-TYPED-${suffix}`, name: "Proveedor tipado de prueba", status: "Activo" } },
      { resource: "customers", payload: { code: `CLI-TYPED-${suffix}`, name: "Cliente tipado de prueba", status: "Activo" } },
      { resource: "movements", payload: { reference: `MV-TYPED-${suffix}`, type: "Ajuste", status: "Pendiente", quantity: 2 } },
      { resource: "queries", payload: { code: `QRY-TYPED-${suffix}`, name: "Consulta tipada de prueba", status: "Borrador" } },
      { resource: "users", payload: { username: `user-typed-${suffix}`, displayName: "Usuario tipado de prueba", email: `user-typed-${suffix}@nortelog.local`, password: "demo123", roleKey: "WAREHOUSE_MANAGER", installationCode: "MADRID01" } },
      { resource: "roles", payload: { key: `ROLE_TYPED_${suffix}`, name: "Rol tipado de prueba", permissionKeys: ["workspace.read"] } },
    ];
    const created = [] as Array<{ resource: string; id: string }>;
    for (const entry of payloads) {
      const response = await request(app).post(`/api/workspace/${entry.resource}`).set("Authorization", `Bearer ${token}`).send({ payload: entry.payload });
      expect(response.status).toBe(201);
      created.push({ resource: entry.resource, id: response.body.id as string });
    }
    const loop = await request(app).post("/api/tools/loop/execute").set("Authorization", `Bearer ${token}`).send({ resource: "picking", ids: [created[0].id], status: "En curso" });
    expect(loop.status).toBe(200);
    expect(loop.body.updated).toBe(1);
    expect(await prisma.pickingTask.findUnique({ where: { id: created[0].id } })).toMatchObject({ status: "En curso" });
    expect(await prisma.shipment.findUnique({ where: { id: created[1].id } })).toMatchObject({ reference: `EX-TYPED-${suffix}` });
    expect(await prisma.location.findUnique({ where: { id: created[2].id } })).toMatchObject({ code: `UB-TYPED-${suffix}` });
    expect(await prisma.inventoryCount.findUnique({ where: { id: created[3].id } })).toMatchObject({ sku: "SKU-100001" });
    expect(await prisma.replenishmentTask.findUnique({ where: { id: created[4].id } })).toMatchObject({ status: "Pendiente" });
    expect(await prisma.product.findUnique({ where: { id: created[5].id } })).toMatchObject({ sku: `SKU-TYPED-${suffix}` });
    expect(await prisma.supplier.findUnique({ where: { id: created[6].id } })).toMatchObject({ code: `PRV-TYPED-${suffix}` });
    expect(await prisma.customer.findUnique({ where: { id: created[7].id } })).toMatchObject({ code: `CLI-TYPED-${suffix}` });
    expect(await prisma.movementRecord.findUnique({ where: { id: created[8].id } })).toMatchObject({ reference: `MV-TYPED-${suffix}`, quantity: 2 });
    expect(await prisma.savedQuery.findUnique({ where: { id: created[9].id } })).toMatchObject({ code: `QRY-TYPED-${suffix}` });
    expect(await prisma.user.findUnique({ where: { id: created[10].id } })).toMatchObject({ username: `user-typed-${suffix}`, email: `user-typed-${suffix}@nortelog.local` });
    expect(await prisma.userInstallation.findFirst({ where: { userId: created[10].id } })).toMatchObject({ installationId: login.body.installation.id });
    expect(await prisma.role.findUnique({ where: { id: created[11].id } })).toMatchObject({ key: `ROLE_TYPED_${suffix}` });
    expect(await prisma.rolePermission.findFirst({ where: { roleId: created[11].id }, include: { permission: true } })).toMatchObject({ permission: { key: "workspace.read" } });

    const userUpdate = await request(app).patch(`/api/workspace/users/${created[10].id}`).set("Authorization", `Bearer ${token}`).send({ payload: { roleKey: "DEVELOPER", installationCode: "MADRID01" } });
    expect(userUpdate.status).toBe(200);
    expect(await prisma.userInstallation.findFirst({ where: { userId: created[10].id }, include: { role: true } })).toMatchObject({ role: { key: "DEVELOPER" } });
    const roleUpdate = await request(app).patch(`/api/workspace/roles/${created[11].id}`).set("Authorization", `Bearer ${token}`).send({ payload: { name: "Rol tipado actualizado", permissionKeys: ["audit.read"] } });
    expect(roleUpdate.status).toBe(200);
    expect(await prisma.rolePermission.findFirst({ where: { roleId: created[11].id }, include: { permission: true } })).toMatchObject({ permission: { key: "audit.read" } });
  });
});
