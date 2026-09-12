import { PrismaClient } from "@prisma/client";
import { hashSync } from "bcryptjs";
import { getWorkspaceRows } from "../src/warehouse-data.js";

const prisma = new PrismaClient();

async function main() {
  const client = await prisma.client.upsert({
    where: { code: "NORTELOG" },
    update: { name: "Nortelog", logoKey: "nortelog" },
    create: { code: "NORTELOG", name: "Nortelog", logoKey: "nortelog" },
  });

  const installation = await prisma.installation.upsert({
    where: { clientId_code: { clientId: client.id, code: "MADRID01" } },
    update: { name: "Valencia · Centro Logístico Mediterráneo" },
    create: { clientId: client.id, code: "MADRID01", name: "Valencia · Centro Logístico Mediterráneo" },
  });

  await prisma.warehouse.upsert({
    where: { installationId_code: { installationId: installation.id, code: "MADRID01_MAIN" } },
    update: { name: "Almacén principal" },
    create: { installationId: installation.id, code: "MADRID01_MAIN", name: "Almacén principal" },
  });

  for (const row of getWorkspaceRows("installations")) {
    if (String(row.code) === "MADRID01") continue;

    await prisma.installation.upsert({
      where: { clientId_code: { clientId: client.id, code: String(row.code) } },
      update: {
        name: String(row.name), city: String(row.city), timezone: String(row.timezone), environment: String(row.environment), version: String(row.version), status: String(row.status), active: String(row.status) !== "Inactiva", managerName: String(row.manager), modulesSummary: String(row.modules), lastSyncAt: row.lastSync ? new Date(String(row.lastSync)) : null,
      },
      create: {
        clientId: client.id, code: String(row.code), name: String(row.name), city: String(row.city), timezone: String(row.timezone), environment: String(row.environment), version: String(row.version), status: String(row.status), active: String(row.status) !== "Inactiva", managerName: String(row.manager), modulesSummary: String(row.modules), lastSyncAt: row.lastSync ? new Date(String(row.lastSync)) : null,
      },
    });
  }

  const warehouseManagerRole = await prisma.role.upsert({
    where: { key: "WAREHOUSE_MANAGER" },
    update: { name: "Gestor de almacén" },
    create: { key: "WAREHOUSE_MANAGER", name: "Gestor de almacén" },
  });

  const developerRole = await prisma.role.upsert({
    where: { key: "DEVELOPER" },
    update: { name: "Developer" },
    create: { key: "DEVELOPER", name: "Developer" },
  });

  const productOwnerRole = await prisma.role.upsert({
    where: { key: "PRODUCT_OWNER" },
    update: { name: "Product Owner" },
    create: { key: "PRODUCT_OWNER", name: "Product Owner" },
  });

  const permissionDefinitions = [
    ["workspace.read", "Consultar módulos", "Permite consultar la información operativa."],
    ["workspace.operate", "Operar almacén", "Permite crear y editar registros operativos."],
    ["audit.read", "Consultar auditoría", "Permite revisar la trazabilidad de acciones."],
    ["configuration.manage", "Gestionar configuración", "Permite editar consultas y acciones de página."],
    ["users.manage", "Gestionar usuarios y roles", "Permite administrar recursos de configuración."],
    ["integrations.execute", "Ejecutar integraciones", "Permite ejecutar y reintentar integraciones."],
    ["tools.sql.execute", "Ejecutar SQL seguro", "Permite lanzar consultas parametrizadas de solo lectura."],
    ["tools.loop.execute", "Ejecutar procesos masivos", "Permite cambiar estados en lote."],
    ["tools.updater.publish", "Publicar actualización", "Permite publicar versión y entorno de una instalación."],
    ["tools.xml.import", "Importar XML", "Permite importar recepciones XML validadas."],
  ] as const;
  const permissions = new Map<string, { id: string; key: string }>();
  for (const [key, name, description] of permissionDefinitions) {
    const permission = await prisma.permission.upsert({ where: { key }, update: { name, description }, create: { key, name, description } });
    permissions.set(key, permission);
  }
  const assignPermissions = async (roleId: string, keys: readonly string[]) => {
    for (const key of keys) {
      const permission = permissions.get(key);
      if (!permission) continue;
      await prisma.rolePermission.upsert({ where: { roleId_permissionId: { roleId, permissionId: permission.id } }, update: {}, create: { roleId, permissionId: permission.id } });
    }
  };
  await assignPermissions(warehouseManagerRole.id, ["workspace.read", "workspace.operate", "audit.read", "tools.loop.execute", "tools.xml.import"]);
  await assignPermissions(developerRole.id, permissionDefinitions.map(([key]) => key));
  await assignPermissions(productOwnerRole.id, permissionDefinitions.map(([key]) => key));

  const user = await prisma.user.upsert({
    where: { username: "jgarcia" },
    update: { displayName: "Javier García", email: "jgarcia@nortelog.com", clientId: client.id, passwordHash: hashSync("demo123", 10) },
    create: {
      username: "jgarcia",
      displayName: "Javier García",
      email: "jgarcia@nortelog.com",
      passwordHash: hashSync("demo123", 10),
      clientId: client.id,
    },
  });

  await prisma.userInstallation.upsert({
    where: { userId_installationId: { userId: user.id, installationId: installation.id } },
    update: { roleId: warehouseManagerRole.id },
    create: { userId: user.id, installationId: installation.id, roleId: warehouseManagerRole.id },
  });

  const developer = await prisma.user.upsert({
    where: { username: "adev" },
    update: { displayName: "Ana Developer", email: "adev@nortelog.com", clientId: client.id, passwordHash: hashSync("demo123", 10) },
    create: { username: "adev", displayName: "Ana Developer", email: "adev@nortelog.com", passwordHash: hashSync("demo123", 10), clientId: client.id },
  });

  await prisma.userInstallation.upsert({
    where: { userId_installationId: { userId: developer.id, installationId: installation.id } },
    update: { roleId: developerRole.id },
    create: { userId: developer.id, installationId: installation.id, roleId: developerRole.id },
  });

  const productOwner = await prisma.user.upsert({
    where: { username: "powner" },
    update: { displayName: "Pablo Product Owner", email: "powner@nortelog.com", clientId: client.id, passwordHash: hashSync("demo123", 10) },
    create: { username: "powner", displayName: "Pablo Product Owner", email: "powner@nortelog.com", passwordHash: hashSync("demo123", 10), clientId: client.id },
  });

  await prisma.userInstallation.upsert({
    where: { userId_installationId: { userId: productOwner.id, installationId: installation.id } },
    update: { roleId: productOwnerRole.id },
    create: { userId: productOwner.id, installationId: installation.id, roleId: productOwnerRole.id },
  });

  const stockRows = getWorkspaceRows("stock");
  for (const row of stockRows) {
    await prisma.stockItem.upsert({
      where: { id: row.id },
      update: {
        installationId: installation.id,
        sku: String(row.sku),
        description: String(row.description),
        lot: String(row.lot),
        serialNumber: row.serialNumber ? String(row.serialNumber) : null,
        warehouse: String(row.warehouse),
        zone: String(row.zone),
        aisle: String(row.aisle),
        bay: String(row.bay),
        level: String(row.level),
        position: String(row.position),
        status: String(row.status),
        quantity: Number(row.quantity),
        available: Number(row.available),
        reserved: Number(row.reserved),
        minimum: Number(row.minimum),
        unit: String(row.unit),
        expiry: row.expiry ? String(row.expiry) : null,
        lastMovement: new Date(String(row.lastMovement)),
        supplier: String(row.supplier),
        owner: String(row.owner),
        updatedBy: String(row.updatedBy),
      },
      create: {
        id: row.id,
        installationId: installation.id,
        sku: String(row.sku),
        description: String(row.description),
        lot: String(row.lot),
        serialNumber: row.serialNumber ? String(row.serialNumber) : null,
        warehouse: String(row.warehouse),
        zone: String(row.zone),
        aisle: String(row.aisle),
        bay: String(row.bay),
        level: String(row.level),
        position: String(row.position),
        status: String(row.status),
        quantity: Number(row.quantity),
        available: Number(row.available),
        reserved: Number(row.reserved),
        minimum: Number(row.minimum),
        unit: String(row.unit),
        expiry: row.expiry ? String(row.expiry) : null,
        lastMovement: new Date(String(row.lastMovement)),
        supplier: String(row.supplier),
        owner: String(row.owner),
        updatedBy: String(row.updatedBy),
      },
    });
  }

  await prisma.$executeRawUnsafe(`
    CREATE OR REPLACE VIEW stock AS
    SELECT
      id,
      sku,
      description,
      lot,
      "serialNumber" AS serial_number,
      warehouse,
      zone,
      aisle,
      bay,
      level,
      position,
      status,
      quantity,
      available,
      reserved,
      minimum,
      unit,
      expiry,
      "lastMovement" AS last_movement,
      supplier,
      owner,
      "updatedBy" AS updated_by,
      "installationId" AS installation_id
    FROM "StockItem"
  `);

  const optionalText = (value: unknown) => value === null || value === undefined || value === "" ? null : String(value);
  const optionalDate = (value: unknown) => value ? new Date(String(value)) : null;
  for (const row of getWorkspaceRows("movements")) {
    await prisma.movementRecord.upsert({
      where: { id: String(row.id) },
      update: {
        installationId: installation.id, reference: String(row.reference), type: String(row.type), sku: optionalText(row.sku), lot: optionalText(row.lot), origin: optionalText(row.origin), destination: optionalText(row.destination), quantity: Number(row.quantity), unit: optionalText(row.unit), operator: optionalText(row.operator), reason: optionalText(row.reason), device: optionalText(row.device), status: String(row.status), sourceDocument: optionalText(row.sourceDocument), createdAt: optionalDate(row.createdAt) ?? new Date(), confirmedAt: optionalDate(row.confirmedAt), observations: optionalText(row.observations),
      },
      create: {
        id: String(row.id), installationId: installation.id, reference: String(row.reference), type: String(row.type), sku: optionalText(row.sku), lot: optionalText(row.lot), origin: optionalText(row.origin), destination: optionalText(row.destination), quantity: Number(row.quantity), unit: optionalText(row.unit), operator: optionalText(row.operator), reason: optionalText(row.reason), device: optionalText(row.device), status: String(row.status), sourceDocument: optionalText(row.sourceDocument), createdAt: optionalDate(row.createdAt) ?? new Date(), confirmedAt: optionalDate(row.confirmedAt), observations: optionalText(row.observations),
      },
    });
  }
  for (const row of getWorkspaceRows("queries")) {
    await prisma.savedQuery.upsert({
      where: { id: String(row.id) },
      update: {
        installationId: installation.id, code: String(row.code), name: String(row.name), category: optionalText(row.category), source: optionalText(row.source), columns: Number(row.columns), filters: Number(row.filters), lastRun: optionalDate(row.lastRun), durationMs: Number(row.durationMs), executions: Number(row.executions), owner: optionalText(row.owner), visibility: optionalText(row.visibility), status: String(row.status),
      },
      create: {
        id: String(row.id), installationId: installation.id, code: String(row.code), name: String(row.name), category: optionalText(row.category), source: optionalText(row.source), columns: Number(row.columns), filters: Number(row.filters), lastRun: optionalDate(row.lastRun), durationMs: Number(row.durationMs), executions: Number(row.executions), owner: optionalText(row.owner), visibility: optionalText(row.visibility), status: String(row.status),
      },
    });
  }
  for (const row of getWorkspaceRows("receipts")) {
    await prisma.receipt.upsert({
      where: { id: String(row.id) },
      update: {
        installationId: installation.id, reference: String(row.reference), supplier: String(row.supplier), supplierDocument: optionalText(row.supplierDocument), purchaseOrder: optionalText(row.purchaseOrder), arrivalDate: optionalDate(row.arrivalDate), scheduledDate: optionalDate(row.scheduledDate), dock: optionalText(row.dock), carrier: optionalText(row.carrier), warehouse: optionalText(row.warehouse), lines: Number(row.lines), units: Number(row.units), priority: String(row.priority), status: String(row.status), receiver: optionalText(row.receiver), qualityCheck: optionalText(row.qualityCheck), createdAt: optionalDate(row.createdAt) ?? new Date(), notes: optionalText(row.notes),
      },
      create: {
        id: String(row.id), installationId: installation.id, reference: String(row.reference), supplier: String(row.supplier), supplierDocument: optionalText(row.supplierDocument), purchaseOrder: optionalText(row.purchaseOrder), arrivalDate: optionalDate(row.arrivalDate), scheduledDate: optionalDate(row.scheduledDate), dock: optionalText(row.dock), carrier: optionalText(row.carrier), warehouse: optionalText(row.warehouse), lines: Number(row.lines), units: Number(row.units), priority: String(row.priority), status: String(row.status), receiver: optionalText(row.receiver), qualityCheck: optionalText(row.qualityCheck), createdAt: optionalDate(row.createdAt) ?? new Date(), notes: optionalText(row.notes),
      },
    });
  }
  for (const row of getWorkspaceRows("picking")) {
    const progress = Number(String(row.progress ?? "0").replace("%", ""));
    await prisma.pickingTask.upsert({
      where: { id: String(row.id) },
      update: {
        installationId: installation.id, reference: String(row.reference), wave: optionalText(row.wave), orderNumber: optionalText(row.order), customer: optionalText(row.customer), route: optionalText(row.route), priority: String(row.priority), zone: optionalText(row.zone), lines: Number(row.lines), units: Number(row.units), progress: Number.isFinite(progress) ? progress : 0, picker: optionalText(row.picker), status: String(row.status), createdAt: optionalDate(row.createdAt) ?? new Date(), dueAt: optionalDate(row.dueAt), startedAt: optionalDate(row.startedAt), carrier: optionalText(row.carrier), observations: optionalText(row.observations),
      },
      create: {
        id: String(row.id), installationId: installation.id, reference: String(row.reference), wave: optionalText(row.wave), orderNumber: optionalText(row.order), customer: optionalText(row.customer), route: optionalText(row.route), priority: String(row.priority), zone: optionalText(row.zone), lines: Number(row.lines), units: Number(row.units), progress: Number.isFinite(progress) ? progress : 0, picker: optionalText(row.picker), status: String(row.status), createdAt: optionalDate(row.createdAt) ?? new Date(), dueAt: optionalDate(row.dueAt), startedAt: optionalDate(row.startedAt), carrier: optionalText(row.carrier), observations: optionalText(row.observations),
      },
    });
  }
  for (const row of getWorkspaceRows("shipments")) {
    await prisma.shipment.upsert({
      where: { id: String(row.id) },
      update: {
        installationId: installation.id, reference: String(row.reference), orderNumber: optionalText(row.order), customer: optionalText(row.customer), shippingDate: optionalDate(row.shippingDate), dock: optionalText(row.dock), route: optionalText(row.route), carrier: optionalText(row.carrier), tracking: optionalText(row.tracking), packages: Number(row.packages), units: Number(row.units), weightKg: Number(row.weightKg), status: String(row.status), operator: optionalText(row.operator), service: optionalText(row.service), createdAt: optionalDate(row.createdAt) ?? new Date(), notes: optionalText(row.notes),
      },
      create: {
        id: String(row.id), installationId: installation.id, reference: String(row.reference), orderNumber: optionalText(row.order), customer: optionalText(row.customer), shippingDate: optionalDate(row.shippingDate), dock: optionalText(row.dock), route: optionalText(row.route), carrier: optionalText(row.carrier), tracking: optionalText(row.tracking), packages: Number(row.packages), units: Number(row.units), weightKg: Number(row.weightKg), status: String(row.status), operator: optionalText(row.operator), service: optionalText(row.service), createdAt: optionalDate(row.createdAt) ?? new Date(), notes: optionalText(row.notes),
      },
    });
  }
  for (const row of getWorkspaceRows("locations")) {
    const code = `${String(row.code)}-${String(row.id).replace("location-", "")}`;
    const capacity = Number(row.capacity);
    const occupied = Number(row.occupied);
    const utilization = Number(String(row.utilization ?? "0").replace("%", ""));
    await prisma.location.upsert({
      where: { id: String(row.id) },
      update: {
        installationId: installation.id, code, warehouse: optionalText(row.warehouse), zone: optionalText(row.zone), type: optionalText(row.type), aisle: optionalText(row.aisle), bay: optionalText(row.bay), level: Number(row.level), position: optionalText(row.position), capacity, occupied, utilization: Number.isFinite(utilization) ? utilization : capacity > 0 ? Math.round((occupied / capacity) * 100) : 0, status: String(row.status), restriction: optionalText(row.restriction), lastInventory: optionalDate(row.lastInventory), updatedBy: optionalText(row.updatedBy),
      },
      create: {
        id: String(row.id), installationId: installation.id, code, warehouse: optionalText(row.warehouse), zone: optionalText(row.zone), type: optionalText(row.type), aisle: optionalText(row.aisle), bay: optionalText(row.bay), level: Number(row.level), position: optionalText(row.position), capacity, occupied, utilization: Number.isFinite(utilization) ? utilization : capacity > 0 ? Math.round((occupied / capacity) * 100) : 0, status: String(row.status), restriction: optionalText(row.restriction), lastInventory: optionalDate(row.lastInventory), updatedBy: optionalText(row.updatedBy),
      },
    });
  }
  for (const row of getWorkspaceRows("inventory")) {
    await prisma.inventoryCount.upsert({
      where: { id: String(row.id) },
      update: {
        installationId: installation.id, reference: String(row.reference), cycle: optionalText(row.cycle), zone: optionalText(row.zone), location: optionalText(row.location), sku: optionalText(row.sku), description: optionalText(row.description), lot: optionalText(row.lot), expected: Number(row.expected), counted: Number(row.counted), difference: Number(row.difference), status: String(row.status), counter: optionalText(row.counter), countedAt: optionalDate(row.countedAt), recheck: optionalText(row.recheck), approvedBy: optionalText(row.approvedBy), lastCount: optionalDate(row.lastCount), notes: optionalText(row.notes),
      },
      create: {
        id: String(row.id), installationId: installation.id, reference: String(row.reference), cycle: optionalText(row.cycle), zone: optionalText(row.zone), location: optionalText(row.location), sku: optionalText(row.sku), description: optionalText(row.description), lot: optionalText(row.lot), expected: Number(row.expected), counted: Number(row.counted), difference: Number(row.difference), status: String(row.status), counter: optionalText(row.counter), countedAt: optionalDate(row.countedAt), recheck: optionalText(row.recheck), approvedBy: optionalText(row.approvedBy), lastCount: optionalDate(row.lastCount), notes: optionalText(row.notes),
      },
    });
  }
  for (const row of getWorkspaceRows("replenishment")) {
    await prisma.replenishmentTask.upsert({
      where: { id: String(row.id) },
      update: {
        installationId: installation.id, reference: String(row.reference), wave: optionalText(row.wave), sku: optionalText(row.sku), description: optionalText(row.description), sourceLocation: optionalText(row.sourceLocation), targetLocation: optionalText(row.targetLocation), current: Number(row.current), minimum: Number(row.minimum), suggested: Number(row.suggested), quantity: Number(row.quantity), unit: optionalText(row.unit), priority: String(row.priority), status: String(row.status), operator: optionalText(row.operator), reason: optionalText(row.reason), route: optionalText(row.route), createdAt: optionalDate(row.createdAt) ?? new Date(), dueAt: optionalDate(row.dueAt), confirmedAt: optionalDate(row.confirmedAt), observations: optionalText(row.observations),
      },
      create: {
        id: String(row.id), installationId: installation.id, reference: String(row.reference), wave: optionalText(row.wave), sku: optionalText(row.sku), description: optionalText(row.description), sourceLocation: optionalText(row.sourceLocation), targetLocation: optionalText(row.targetLocation), current: Number(row.current), minimum: Number(row.minimum), suggested: Number(row.suggested), quantity: Number(row.quantity), unit: optionalText(row.unit), priority: String(row.priority), status: String(row.status), operator: optionalText(row.operator), reason: optionalText(row.reason), route: optionalText(row.route), createdAt: optionalDate(row.createdAt) ?? new Date(), dueAt: optionalDate(row.dueAt), confirmedAt: optionalDate(row.confirmedAt), observations: optionalText(row.observations),
      },
    });
  }
  for (const row of getWorkspaceRows("products")) {
    await prisma.product.upsert({
      where: { id: String(row.id) },
      update: {
        installationId: installation.id, sku: String(row.sku), gtin: optionalText(row.gtin), description: String(row.description), family: optionalText(row.family), category: optionalText(row.category), brand: optionalText(row.brand), unit: optionalText(row.unit), packSize: Number(row.packSize), weightKg: Number(row.weightKg), dimensions: optionalText(row.dimensions), lotRequired: optionalText(row.lotRequired), expiryRequired: optionalText(row.expiryRequired), serialRequired: optionalText(row.serialRequired), supplier: optionalText(row.supplier), minStock: Number(row.minStock), maxStock: Number(row.maxStock), leadTimeDays: Number(row.leadTimeDays), active: String(row.active), status: String(row.status), updatedBy: optionalText(row.updatedBy),
      },
      create: {
        id: String(row.id), installationId: installation.id, sku: String(row.sku), gtin: optionalText(row.gtin), description: String(row.description), family: optionalText(row.family), category: optionalText(row.category), brand: optionalText(row.brand), unit: optionalText(row.unit), packSize: Number(row.packSize), weightKg: Number(row.weightKg), dimensions: optionalText(row.dimensions), lotRequired: optionalText(row.lotRequired), expiryRequired: optionalText(row.expiryRequired), serialRequired: optionalText(row.serialRequired), supplier: optionalText(row.supplier), minStock: Number(row.minStock), maxStock: Number(row.maxStock), leadTimeDays: Number(row.leadTimeDays), active: String(row.active), status: String(row.status), updatedBy: optionalText(row.updatedBy),
      },
    });
  }
  for (const row of getWorkspaceRows("suppliers")) {
    await prisma.supplier.upsert({
      where: { id: String(row.id) },
      update: {
        installationId: installation.id, code: String(row.code), name: String(row.name), legalName: optionalText(row.legalName), taxId: optionalText(row.taxId), contact: optionalText(row.contact), email: optionalText(row.email), phone: optionalText(row.phone), country: optionalText(row.country), city: optionalText(row.city), leadTimeDays: Number(row.leadTimeDays), serviceLevel: optionalText(row.serviceLevel), paymentTerms: optionalText(row.paymentTerms), incoterm: optionalText(row.incoterm), openOrders: Number(row.openOrders), lastOrder: optionalDate(row.lastOrder), active: String(row.active), status: String(row.status),
      },
      create: {
        id: String(row.id), installationId: installation.id, code: String(row.code), name: String(row.name), legalName: optionalText(row.legalName), taxId: optionalText(row.taxId), contact: optionalText(row.contact), email: optionalText(row.email), phone: optionalText(row.phone), country: optionalText(row.country), city: optionalText(row.city), leadTimeDays: Number(row.leadTimeDays), serviceLevel: optionalText(row.serviceLevel), paymentTerms: optionalText(row.paymentTerms), incoterm: optionalText(row.incoterm), openOrders: Number(row.openOrders), lastOrder: optionalDate(row.lastOrder), active: String(row.active), status: String(row.status),
      },
    });
  }
  for (const row of getWorkspaceRows("customers")) {
    await prisma.customer.upsert({
      where: { id: String(row.id) },
      update: {
        installationId: installation.id, code: String(row.code), name: String(row.name), legalName: optionalText(row.legalName), taxId: optionalText(row.taxId), channel: optionalText(row.channel), segment: optionalText(row.segment), contact: optionalText(row.contact), email: optionalText(row.email), phone: optionalText(row.phone), city: optionalText(row.city), country: optionalText(row.country), serviceLevel: optionalText(row.serviceLevel), routes: Number(row.routes), ordersMonth: Number(row.ordersMonth), lastOrder: optionalDate(row.lastOrder), active: String(row.active), status: String(row.status),
      },
      create: {
        id: String(row.id), installationId: installation.id, code: String(row.code), name: String(row.name), legalName: optionalText(row.legalName), taxId: optionalText(row.taxId), channel: optionalText(row.channel), segment: optionalText(row.segment), contact: optionalText(row.contact), email: optionalText(row.email), phone: optionalText(row.phone), city: optionalText(row.city), country: optionalText(row.country), serviceLevel: optionalText(row.serviceLevel), routes: Number(row.routes), ordersMonth: Number(row.ordersMonth), lastOrder: optionalDate(row.lastOrder), active: String(row.active), status: String(row.status),
      },
    });
  }
  for (const row of getWorkspaceRows("integrations")) {
    await prisma.integration.upsert({
      where: { id: String(row.id) },
      update: {
        installationId: installation.id, code: String(row.code), name: String(row.name), type: optionalText(row.type), protocol: String(row.protocol), endpoint: optionalText(row.endpoint), direction: optionalText(row.direction), installationCode: optionalText(row.installation), frequency: optionalText(row.frequency), status: String(row.status), lastExecution: optionalDate(row.lastExecution), nextExecution: optionalDate(row.nextExecution), latencyMs: Number(row.latencyMs), processed: Number(row.processed), failed: Number(row.failed), retryPolicy: optionalText(row.retryPolicy), version: optionalText(row.version), lastError: optionalText(row.lastError),
      },
      create: {
        id: String(row.id), installationId: installation.id, code: String(row.code), name: String(row.name), type: optionalText(row.type), protocol: String(row.protocol), endpoint: optionalText(row.endpoint), direction: optionalText(row.direction), installationCode: optionalText(row.installation), frequency: optionalText(row.frequency), status: String(row.status), lastExecution: optionalDate(row.lastExecution), nextExecution: optionalDate(row.nextExecution), latencyMs: Number(row.latencyMs), processed: Number(row.processed), failed: Number(row.failed), retryPolicy: optionalText(row.retryPolicy), version: optionalText(row.version), lastError: optionalText(row.lastError),
      },
    });
  }

  const storedResources = [
    "receipts", "picking", "shipments", "locations", "movements", "inventory", "queries",
    "users", "products", "replenishment", "suppliers", "customers", "integrations", "audit", "roles",
  ] as const;
  for (const resource of storedResources) {
    for (const row of getWorkspaceRows(resource)) {
      const payload = JSON.parse(JSON.stringify(row)) as Record<string, unknown>;
      await prisma.workspaceRecord.upsert({
        where: { id: String(row.id) },
        update: {
          installationId: installation.id,
          resource,
          reference: String(row.id),
          status: row.status ? String(row.status) : null,
          payload,
          source: "SEED",
        },
        create: {
          id: String(row.id),
          installationId: installation.id,
          resource,
          reference: String(row.id),
          status: row.status ? String(row.status) : null,
          payload,
          source: "SEED",
        },
      });
    }

    const keys = Array.from(new Set(getWorkspaceRows(resource).flatMap((row) => Object.keys(row))));
    const quoteIdentifier = (value: string) => `"${value.replace(/"/g, '""')}"`;
    const quoteLiteral = (value: string) => value.replace(/'/g, "''");
    const columns = keys.map((key) => `payload ->> '${quoteLiteral(key)}' AS ${quoteIdentifier(key)}`).join(",\n       ");
    const typedViews: Record<string, string> = {
      receipts: `SELECT id, reference, supplier, "supplierDocument" AS "supplierDocument", "purchaseOrder" AS "purchaseOrder", "arrivalDate" AS "arrivalDate", "scheduledDate" AS "scheduledDate", dock, carrier, warehouse, lines, units, priority, status, receiver, "qualityCheck" AS "qualityCheck", "createdAt" AS "createdAt", notes, "installationId" AS installation_id FROM "Receipt"`,
      picking: `SELECT id, reference, wave, "orderNumber" AS "order", customer, route, priority, zone, lines, units, progress || '%' AS progress, picker, status, "createdAt" AS "createdAt", "dueAt" AS "dueAt", "startedAt" AS "startedAt", carrier, observations, "installationId" AS installation_id FROM "PickingTask"`,
      shipments: `SELECT id, reference, "orderNumber" AS "order", customer, "shippingDate" AS "shippingDate", dock, route, carrier, tracking, packages, units, "weightKg" AS "weightKg", status, operator, service, "createdAt" AS "createdAt", notes, "installationId" AS installation_id FROM "Shipment"`,
      locations: `SELECT id, code, warehouse, zone, type, aisle, bay, level, position, capacity, occupied, utilization || '%' AS utilization, status, restriction, "lastInventory" AS "lastInventory", "updatedBy" AS "updatedBy", "installationId" AS installation_id FROM "Location"`,
      inventory: `SELECT id, reference, cycle, zone, location, sku, description, lot, expected, counted, difference, status, counter, "countedAt" AS "countedAt", recheck, "approvedBy" AS "approvedBy", "lastCount" AS "lastCount", notes, "installationId" AS installation_id FROM "InventoryCount"`,
      replenishment: `SELECT id, reference, wave, sku, description, "sourceLocation" AS "sourceLocation", "targetLocation" AS "targetLocation", current, minimum, suggested, quantity, unit, priority, status, operator, reason, route, "createdAt" AS "createdAt", "dueAt" AS "dueAt", "confirmedAt" AS "confirmedAt", observations, "installationId" AS installation_id FROM "ReplenishmentTask"`,
      products: `SELECT id, sku, gtin, description, family, category, brand, unit, "packSize" AS "packSize", "weightKg" AS "weightKg", dimensions, "lotRequired" AS "lotRequired", "expiryRequired" AS "expiryRequired", "serialRequired" AS "serialRequired", supplier, "minStock" AS "minStock", "maxStock" AS "maxStock", "leadTimeDays" AS "leadTimeDays", active, status, "updatedBy" AS "updatedBy", "installationId" AS installation_id FROM "Product"`,
      suppliers: `SELECT id, code, name, "legalName" AS "legalName", "taxId" AS "taxId", contact, email, phone, country, city, "leadTimeDays" AS "leadTimeDays", "serviceLevel" AS "serviceLevel", "paymentTerms" AS "paymentTerms", incoterm, "openOrders" AS "openOrders", "lastOrder" AS "lastOrder", active, status, "installationId" AS installation_id FROM "Supplier"`,
      customers: `SELECT id, code, name, "legalName" AS "legalName", "taxId" AS "taxId", channel, segment, contact, email, phone, city, country, "serviceLevel" AS "serviceLevel", routes, "ordersMonth" AS "ordersMonth", "lastOrder" AS "lastOrder", active, status, "installationId" AS installation_id FROM "Customer"`,
      integrations: `SELECT id, code, name, type, protocol, endpoint, direction, "installationCode" AS "installation", frequency, status, "lastExecution" AS "lastExecution", "nextExecution" AS "nextExecution", "latencyMs" AS "latencyMs", processed, failed, "retryPolicy" AS "retryPolicy", version, "lastError" AS "lastError", "installationId" AS installation_id FROM "Integration"`,
      movements: `SELECT id, reference, type, sku, lot, origin, destination, quantity, unit, operator, reason, device, status, "sourceDocument" AS "sourceDocument", "createdAt" AS "createdAt", "confirmedAt" AS "confirmedAt", observations, "installationId" AS installation_id FROM "MovementRecord"`,
      queries: `SELECT id, code, name, category, source, columns, filters, "lastRun" AS "lastRun", "durationMs" AS "durationMs", executions, owner, visibility, status, "installationId" AS installation_id FROM "SavedQuery"`,
    };
    await prisma.$executeRawUnsafe(`DROP VIEW IF EXISTS ${quoteIdentifier(resource)} CASCADE`);
    await prisma.$executeRawUnsafe(`CREATE VIEW ${quoteIdentifier(resource)} AS ${typedViews[resource] ?? `SELECT ${columns}, "installationId" AS installation_id FROM "WorkspaceRecord" WHERE resource = '${quoteLiteral(resource)}'`}`);
  }

  const stockColumns = [
    { key: "sku", label: "SKU", visible: true, type: "text" },
    { key: "description", label: "Descripción", visible: true, type: "text" },
    { key: "lot", label: "Lote", visible: true, type: "text" },
    { key: "warehouse", label: "Almacén", visible: true, type: "text" },
    { key: "zone", label: "Zona", visible: true, type: "text" },
    { key: "quantity", label: "Cantidad", visible: true, type: "number", decimals: 0 },
    { key: "available", label: "Disponible", visible: true, type: "number", decimals: 0, background: "#eff6ff", textColor: "#1d4ed8" },
    { key: "reserved", label: "Reservado", visible: false, type: "number", decimals: 0 },
    { key: "status", label: "Estado", visible: true, type: "status", badge: true, conditions: [
      { operator: "eq", value: "Disponible", background: "#dcfce7", textColor: "#166534" },
      { operator: "eq", value: "Bloqueado", background: "#fee2e2", textColor: "#991b1b" },
      { operator: "eq", value: "Reservado", background: "#fef3c7", textColor: "#92400e" },
    ] },
  ];
  const stockFilters = [{ key: "warehouse", label: "Almacén", type: "select" }, { key: "zone", label: "Zona", type: "select" }, { key: "status", label: "Estado", type: "select" }, { key: "sku", label: "SKU", type: "text" }];

  await prisma.queryConfiguration.upsert({
    where: { installationId_resource: { installationId: installation.id, resource: "stock" } },
    update: {
      name: "Stock operativo",
      description: "Existencias disponibles para la operación diaria del almacén.",
      sqlText: "SELECT sku, description, lot, warehouse, zone, quantity, available, reserved, status\nFROM stock\nWHERE installation_id = :installationId\n  AND available > 0\nORDER BY last_movement DESC",
      columns: stockColumns,
      filters: stockFilters,
      parameters: ["installationId"],
      defaultSort: "lastMovement desc",
      actions: ["Exportar", "Ajustar stock", "Ver movimientos"],
      allowedRoles: ["WAREHOUSE_MANAGER", "DEVELOPER", "PRODUCT_OWNER"],
      status: "PUBLISHED",
      version: 1,
      publishedAt: new Date(),
      updatedByName: "Ana Developer",
    },
    create: {
      clientId: client.id,
      installationId: installation.id,
      resource: "stock",
      name: "Stock operativo",
      description: "Existencias disponibles para la operación diaria del almacén.",
      sqlText: "SELECT sku, description, lot, warehouse, zone, quantity, available, reserved, status\nFROM stock\nWHERE installation_id = :installationId\n  AND available > 0\nORDER BY last_movement DESC",
      columns: stockColumns,
      filters: stockFilters,
      parameters: ["installationId"],
      defaultSort: "lastMovement desc",
      actions: ["Exportar", "Ajustar stock", "Ver movimientos"],
      allowedRoles: ["WAREHOUSE_MANAGER", "DEVELOPER", "PRODUCT_OWNER"],
      status: "PUBLISHED",
      version: 1,
      publishedAt: new Date(),
      updatedByName: "Ana Developer",
    },
  });

  const configurableResources = ["receipts", "picking", "shipments", "inventory", "movements", "queries", "locations", "products", "replenishment", "suppliers", "customers", "users", "roles", "integrations"] as const;
  for (const resource of configurableResources) {
    const existing = await prisma.queryConfiguration.findUnique({ where: { installationId_resource: { installationId: installation.id, resource } } });
    if (existing) continue;
    const rows = getWorkspaceRows(resource);
    const sample = rows[0] ?? { id: "id", status: "" };
    const columns = Object.keys(sample).map((key) => ({ key, label: key, visible: key !== "id", type: typeof sample[key] === "number" ? "number" : key === "status" ? "status" : "text", badge: key === "status" }));
    await prisma.queryConfiguration.create({
      data: {
        clientId: client.id,
        installationId: installation.id,
        resource,
        name: `${resource} operativo`,
        description: `Consulta configurable de ${resource}.`,
        sqlText: `SELECT * FROM ${resource} WHERE installation_id = :installationId ORDER BY id ASC`,
        columns,
        filters: [{ key: "status", label: "Estado", type: "select" }],
        parameters: ["installationId"],
        defaultSort: "id asc",
        actions: ["Exportar"],
        allowedRoles: ["WAREHOUSE_MANAGER", "DEVELOPER", "PRODUCT_OWNER"],
        status: "PUBLISHED",
        version: 1,
        publishedAt: new Date(),
        updatedByName: "Ana Developer",
      },
    });
  }

  console.log("Datos demo creados: jgarcia, adev y powner / demo123");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
