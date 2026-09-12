export type WorkspaceResource = "stock" | "receipts" | "picking" | "shipments" | "installations" | "locations" | "movements" | "inventory" | "queries" | "users" | "products" | "replenishment" | "suppliers" | "customers" | "integrations" | "audit" | "roles";

export type WorkspaceRow = Record<string, string | number | null> & { id: string };

const pad = (value: number, length = 4) => String(value).padStart(length, "0");
const dateAt = (daysAgo: number, hour: number) => {
  const date = new Date("2026-08-21T00:00:00.000Z");
  date.setUTCDate(date.getUTCDate() - daysAgo);
  date.setUTCHours(hour, (daysAgo * 7) % 60, 0, 0);
  return date.toISOString();
};

const statuses = ["Disponible", "Reservado", "Bloqueado", "En tránsito"];
const stockDescriptions = ["Caja cartón reforzada", "Film estirable transparente", "Terminal RF industrial", "Palé europeo", "Etiqueta térmica 100x150", "Batería recargable", "Cantonera de protección", "Precinto adhesivo" ];
const zones = ["RECEPCIÓN", "A", "B", "C", "CÁMARA FRÍO", "EXPEDICIÓN"];

const buildStock = (): WorkspaceRow[] => Array.from({ length: 3200 }, (_, index) => {
  const number = index + 1;
  const quantity = 24 + ((number * 37) % 980);
  const reserved = (number * 13) % Math.min(quantity, 140);
  return {
    id: `stock-${number}`,
    sku: `SKU-${pad(100000 + number, 6)}`,
    description: stockDescriptions[index % stockDescriptions.length],
    lot: `LOTE-${2026}${pad((number % 48) + 1, 2)}`,
    serialNumber: number % 4 === 0 ? `SN-${pad(700000 + number, 7)}` : null,
    warehouse: number % 3 === 0 ? "MADRID01_FRIO" : "MADRID01_MAIN",
    zone: zones[index % zones.length],
    aisle: `${String.fromCharCode(65 + (index % 8))}-${pad((index % 24) + 1, 2)}`,
    bay: `${pad((index % 18) + 1, 2)}`,
    level: `${(index % 5) + 1}`,
    position: `P-${pad((index % 12) + 1, 2)}`,
    status: statuses[index % statuses.length],
    quantity,
    available: quantity - reserved,
    reserved,
    minimum: 30 + ((number * 11) % 180),
    unit: number % 3 === 0 ? "cajas" : "uds",
    expiry: number % 5 === 0 ? dateAt(-((number % 180) + 30), 12).slice(0, 10) : null,
    lastMovement: dateAt(number % 12, 7 + (number % 12)),
    supplier: ["Logística Iberia", "Pack Solutions", "TecnoAlmacén", "Distribuciones Centro"][index % 4],
    owner: "NORTELOG",
    updatedBy: ["Javier García", "Marta López", "Sistema RF"][index % 3],
  };
});

const buildReceipts = (): WorkspaceRow[] => Array.from({ length: 360 }, (_, index) => {
  const number = index + 1;
  const status = ["Pendiente", "En descarga", "Parcial", "Completada", "Incidencia"][index % 5];
  return {
    id: `receipt-${number}`,
    reference: `RC-${pad(10480 + number)}`,
    supplier: ["Logística Iberia", "Pack Solutions", "TecnoAlmacén", "Distribuciones Centro"][index % 4],
    supplierDocument: `ALB-${2026000 + number}`,
    purchaseOrder: `OC-${pad(43000 + number)}`,
    arrivalDate: dateAt(index % 28, 6 + (index % 10)),
    scheduledDate: dateAt((index % 28) + (index % 3), 8),
    dock: `M${(index % 12) + 1}`,
    carrier: ["DHL Freight", "SEUR", "Trans Iberia", "Transportes Norte"][index % 4],
    warehouse: index % 3 === 0 ? "MADRID01_FRIO" : "MADRID01_MAIN",
    lines: 2 + (index % 34),
    units: 40 + ((index * 73) % 4800),
    priority: index % 7 === 0 ? "Alta" : index % 3 === 0 ? "Media" : "Normal",
    status,
    receiver: ["Javier García", "Marta López", "Álvaro Ruiz"][index % 3],
    qualityCheck: index % 4 === 0 ? "Pendiente" : "Conforme",
    createdAt: dateAt((index % 32) + 1, 9),
    notes: index % 9 === 0 ? "Revisar embalaje antes de ubicar" : null,
  };
});

const buildPicking = (): WorkspaceRow[] => Array.from({ length: 280 }, (_, index) => {
  const number = index + 1;
  return {
    id: `picking-${number}`,
    reference: `PK-${pad(3150 + number)}`,
    wave: `OLA-${pad((index % 84) + 1, 3)}`,
    order: `PED-${20260000 + number}`,
    customer: ["Grupo Atlas", "Retail Centro", "Hospital San Lucas", "Market Online", "Norte Industrial"][index % 5],
    route: `R-${String.fromCharCode(65 + (index % 8))}${(index % 6) + 1}`,
    priority: index % 8 === 0 ? "Urgente" : index % 3 === 0 ? "Alta" : "Normal",
    zone: zones[(index + 1) % zones.length],
    lines: 1 + (index % 28),
    units: 5 + ((index * 29) % 420),
    progress: `${(index * 17) % 101}%`,
    picker: ["Javier García", "Marta López", "Álvaro Ruiz", "Sin asignar"][index % 4],
    status: ["Pendiente", "En curso", "Pausado", "Completado"][index % 4],
    createdAt: dateAt(index % 16, 7 + (index % 10)),
    dueAt: dateAt(Math.max(0, (index % 8) - 2), 18),
    startedAt: index % 4 === 0 ? dateAt(index % 12, 8) : null,
    carrier: ["SEUR", "DHL", "Correos Express", "Trans Iberia"][index % 4],
    observations: index % 11 === 0 ? "Esperando reposición de ubicación" : null,
  };
});

const buildShipments = (): WorkspaceRow[] => Array.from({ length: 240 }, (_, index) => {
  const number = index + 1;
  return {
    id: `shipment-${number}`,
    reference: `EX-${pad(7750 + number)}`,
    order: `PED-${20260000 + (number * 2)}`,
    customer: ["Grupo Atlas", "Retail Centro", "Hospital San Lucas", "Market Online", "Norte Industrial"][index % 5],
    shippingDate: dateAt(index % 20, 11 + (index % 8)),
    dock: `S${(index % 10) + 1}`,
    route: `R-${String.fromCharCode(65 + (index % 8))}${(index % 6) + 1}`,
    carrier: ["SEUR", "DHL", "Correos Express", "Trans Iberia"][index % 4],
    tracking: `${["SEUR", "DHL", "COR"][index % 3]}${2026000000 + number}`,
    packages: 1 + (index % 18),
    units: 4 + ((index * 31) % 360),
    weightKg: Number((12 + ((index * 7.3) % 480)).toFixed(1)),
    status: ["Preparando", "Listo para cargar", "Cargado", "Expedido", "Incidencia"][index % 5],
    operator: ["Javier García", "Marta López", "Álvaro Ruiz"][index % 3],
    service: ["24h", "Estándar", "Internacional"][index % 3],
    createdAt: dateAt((index % 24) + 1, 8),
    notes: index % 13 === 0 ? "Documentación pendiente" : null,
  };
});

const buildInstallations = (): WorkspaceRow[] => Array.from({ length: 24 }, (_, index) => {
  const number = index + 1;
  return {
    id: `installation-${number}`,
    code: `MADRID${pad(number, 2)}`,
    name: [`Centro Logístico Madrid ${number}`, `Plataforma Norte ${number}`, `Hub Distribución ${number}`][index % 3],
    city: ["Madrid", "Valladolid", "Zaragoza", "Valencia"][index % 4],
    timezone: "Europe/Madrid",
    warehouses: 1 + (index % 5),
    environment: index % 4 === 0 ? "Preproducción" : "Producción",
    version: `0.${1 + (index % 3)}.${index % 10}`,
    status: index % 9 === 0 ? "Mantenimiento" : "Activa",
    users: 12 + ((index * 9) % 86),
    manager: ["Javier García", "Marta López", "Álvaro Ruiz"][index % 3],
    modules: `${4 + (index % 4)} módulos activos`,
    lastSync: dateAt(index % 5, 6 + (index % 12)),
    updatedAt: dateAt(index % 10, 9),
  };
});

const buildLocations = (): WorkspaceRow[] => Array.from({ length: 520 }, (_, index) => {
  const number = index + 1;
  return {
    id: `location-${number}`,
    code: `UB-${String.fromCharCode(65 + (index % 8))}${pad((index % 48) + 1, 2)}-${(index % 5) + 1}-${pad((index % 12) + 1, 2)}`,
    warehouse: index % 3 === 0 ? "MADRID01_FRIO" : "MADRID01_MAIN",
    zone: zones[index % zones.length],
    type: ["Estantería", "Suelo", "Picking", "Muelle", "Cuarentena"][index % 5],
    aisle: `${String.fromCharCode(65 + (index % 8))}-${pad((index % 24) + 1, 2)}`,
    bay: pad((index % 18) + 1, 2),
    level: (index % 5) + 1,
    position: `P-${pad((index % 12) + 1, 2)}`,
    capacity: 80 + ((index * 17) % 920),
    occupied: 20 + ((index * 29) % 740),
    utilization: `${42 + ((index * 11) % 58)}%`,
    status: ["Disponible", "Ocupada", "Bloqueada", "Inventario"][index % 4],
    restriction: index % 6 === 0 ? "Frágil" : index % 7 === 0 ? "Temperatura controlada" : "—",
    lastInventory: dateAt(index % 45, 10),
    updatedBy: ["Sistema RF", "Marta López", "Javier García"][index % 3],
  };
});

const buildMovements = (): WorkspaceRow[] => Array.from({ length: 1200 }, (_, index) => {
  const number = index + 1;
  return {
    id: `movement-${number}`,
    reference: `MV-${pad(2080 + number)}`,
    type: ["Reposición", "Traspaso", "Ajuste", "Entrada", "Salida", "Inventario"][index % 6],
    sku: `SKU-${pad(100000 + ((index * 7) % 3199) + 1, 6)}`,
    lot: `LOTE-${2026}${pad((index % 48) + 1, 2)}`,
    origin: index % 5 === 0 ? "RECEPCIÓN" : `UB-${String.fromCharCode(65 + (index % 8))}${pad((index % 24) + 1, 2)}`,
    destination: index % 6 === 0 ? "EXPEDICIÓN" : `UB-${String.fromCharCode(65 + ((index + 2) % 8))}${pad(((index + 4) % 24) + 1, 2)}`,
    quantity: 1 + ((index * 19) % 240),
    unit: index % 3 === 0 ? "cajas" : "uds",
    operator: ["Javier García", "Marta López", "Álvaro Ruiz", "Sistema RF"][index % 4],
    reason: ["Reposición de picking", "Cambio de ubicación", "Diferencia inventario", "Recepción proveedor"][index % 4],
    device: index % 4 === 3 ? "JOB-ALMACEN" : `RF-${pad((index % 34) + 1, 2)}`,
    status: ["Confirmado", "Pendiente", "En curso", "Anulado"][index % 4],
    sourceDocument: `${["RC", "PK", "EX", "AJ"][index % 4]}-${pad(1000 + number)}`,
    createdAt: dateAt(index % 30, 6 + (index % 12)),
    confirmedAt: index % 4 === 1 ? null : dateAt(index % 20, 8 + (index % 8)),
    observations: index % 15 === 0 ? "Requiere revisión de supervisor" : null,
  };
});

const buildInventory = (): WorkspaceRow[] => Array.from({ length: 420 }, (_, index) => {
  const number = index + 1;
  const expected = 20 + ((index * 41) % 480);
  const difference = index % 7 === 0 ? (index % 5) - 2 : 0;
  return {
    id: `inventory-${number}`,
    reference: `INV-${pad(6000 + number)}`,
    cycle: `CICLO-${pad((index % 18) + 1, 2)}`,
    zone: zones[index % zones.length],
    location: `UB-${String.fromCharCode(65 + (index % 8))}${pad((index % 24) + 1, 2)}`,
    sku: `SKU-${pad(100000 + ((index * 11) % 3199) + 1, 6)}`,
    description: stockDescriptions[index % stockDescriptions.length],
    lot: `LOTE-${2026}${pad((index % 48) + 1, 2)}`,
    expected,
    counted: expected + difference,
    difference,
    status: difference === 0 ? "Conforme" : index % 3 === 0 ? "Pendiente revisión" : "Con diferencia",
    counter: ["Marta López", "Álvaro Ruiz", "Javier García", "Sin asignar"][index % 4],
    countedAt: index % 4 === 3 ? null : dateAt(index % 25, 8 + (index % 9)),
    recheck: difference === 0 ? "No" : index % 3 === 0 ? "Sí" : "No",
    approvedBy: index % 5 === 0 ? "Marta López" : null,
    lastCount: dateAt((index % 60) + 1, 11),
    notes: index % 13 === 0 ? "Contar con lector RF" : null,
  };
});

const buildQueries = (): WorkspaceRow[] => Array.from({ length: 36 }, (_, index) => {
  const number = index + 1;
  return {
    id: `query-${number}`,
    code: `QRY-${pad(number, 3)}`,
    name: ["Stock por ubicación", "Recepciones con incidencia", "Movimientos del día", "Pedidos pendientes", "Diferencias de inventario", "Productividad picking"][index % 6],
    category: ["Stock", "Operaciones", "Inventario", "Rendimiento"][index % 4],
    source: ["stock", "receipts", "movements", "picking"][index % 4],
    columns: 6 + (index % 12),
    filters: 2 + (index % 8),
    lastRun: dateAt(index % 7, 7 + (index % 11)),
    durationMs: 90 + ((index * 71) % 1800),
    executions: 12 + ((index * 19) % 920),
    owner: ["Sistema", "Javier García", "Ana Developer", "Pablo Product Owner"][index % 4],
    visibility: index % 3 === 0 ? "Privada" : "Instalación",
    status: index % 8 === 0 ? "Borrador" : "Publicada",
    updatedAt: dateAt(index % 16, 12),
  };
});

const buildUsers = (): WorkspaceRow[] => Array.from({ length: 48 }, (_, index) => {
  const number = index + 1;
  return {
    id: `user-${number}`,
    username: index === 0 ? "jgarcia" : `usuario${pad(number, 2)}`,
    displayName: ["Javier García", "Marta López", "Álvaro Ruiz", "Ana Developer", "Pablo Product Owner"][index % 5],
    email: index === 0 ? "jgarcia@nortelog.com" : `usuario${pad(number, 2)}@nortelog.com`,
    role: ["Gestor de almacén", "Gestor de almacén", "Gestor de almacén", "Developer", "Product Owner"][index % 5],
    installation: `MADRID${pad((index % 8) + 1, 2)}`,
    warehouse: index % 3 === 0 ? "MADRID01_FRIO" : "MADRID01_MAIN",
    status: index % 10 === 0 ? "Bloqueado" : index % 7 === 0 ? "Pendiente" : "Activo",
    lastAccess: dateAt(index % 12, 7 + (index % 11)),
    sessions: index % 8,
    modules: `${5 + (index % 6)} módulos`,
    createdAt: dateAt((index % 180) + 20, 10),
    updatedAt: dateAt(index % 20, 9),
  };
});

const buildProducts = (): WorkspaceRow[] => Array.from({ length: 620 }, (_, index) => {
  const number = index + 1;
  const active = index % 17 !== 0;
  return {
    id: `product-${number}`,
    sku: `SKU-${pad(100000 + number, 6)}`,
    gtin: `084${pad(1000000000 + number, 10)}`,
    description: stockDescriptions[index % stockDescriptions.length],
    family: ["Embalaje", "Consumible", "Equipamiento", "Repuesto", "Producto terminado"][index % 5],
    category: ["Preparación", "Recepción", "Seguridad", "Frío", "Expedición"][index % 5],
    brand: ["NortePack", "IberiaTools", "TecnoRF", "SGA Parts"][index % 4],
    unit: ["uds", "cajas", "palés", "kg"][index % 4],
    packSize: 1 + (index % 48),
    weightKg: Number((0.2 + ((index * 1.7) % 42)).toFixed(2)),
    dimensions: `${20 + (index % 80)}x${15 + (index % 60)}x${8 + (index % 45)} cm`,
    lotRequired: index % 3 !== 0 ? "Sí" : "No",
    expiryRequired: index % 8 === 0 ? "Sí" : "No",
    serialRequired: index % 11 === 0 ? "Sí" : "No",
    supplier: ["Logística Iberia", "Pack Solutions", "TecnoAlmacén", "Distribuciones Centro"][index % 4],
    minStock: 20 + ((index * 13) % 180),
    maxStock: 260 + ((index * 31) % 1800),
    leadTimeDays: 1 + (index % 18),
    active: active ? "Sí" : "No",
    status: !active ? "Inactivo" : index % 13 === 0 ? "Bloqueado" : "Activo",
    updatedAt: dateAt(index % 90, 9),
    updatedBy: ["Javier García", "Marta López", "Sistema ERP"][index % 3],
  };
});

const buildReplenishment = (): WorkspaceRow[] => Array.from({ length: 460 }, (_, index) => {
  const number = index + 1;
  const current = 2 + ((index * 7) % 36);
  const minimum = 18 + ((index * 11) % 90);
  return {
    id: `replenishment-${number}`,
    reference: `REP-${pad(9200 + number)}`,
    wave: `OLA-REP-${pad((index % 42) + 1, 3)}`,
    sku: `SKU-${pad(100000 + ((index * 7) % 619) + 1, 6)}`,
    description: stockDescriptions[index % stockDescriptions.length],
    sourceLocation: `UB-${String.fromCharCode(65 + (index % 8))}${pad((index % 32) + 1, 2)}`,
    targetLocation: `PK-${String.fromCharCode(65 + ((index + 2) % 8))}${pad((index % 20) + 1, 2)}`,
    current,
    minimum,
    suggested: Math.max(0, minimum * 3 - current),
    quantity: 8 + ((index * 23) % 240),
    unit: index % 3 === 0 ? "cajas" : "uds",
    priority: index % 9 === 0 ? "Urgente" : index % 3 === 0 ? "Alta" : "Normal",
    status: ["Pendiente", "Asignada", "En curso", "Completada", "Bloqueada"][index % 5],
    operator: ["Javier García", "Marta López", "Álvaro Ruiz", "Sin asignar"][index % 4],
    reason: ["Mínimo de picking", "Pedido urgente", "Reorganización", "Previsión de demanda"][index % 4],
    route: `R-${String.fromCharCode(65 + (index % 8))}${(index % 6) + 1}`,
    createdAt: dateAt(index % 21, 7 + (index % 10)),
    dueAt: dateAt(Math.max(0, (index % 5) - 1), 18),
    confirmedAt: index % 4 === 0 ? null : dateAt(index % 12, 11),
    observations: index % 14 === 0 ? "Validar ubicación origen" : null,
  };
});

const buildSuppliers = (): WorkspaceRow[] => Array.from({ length: 86 }, (_, index) => {
  const number = index + 1;
  return {
    id: `supplier-${number}`,
    code: `PRV-${pad(number, 4)}`,
    name: ["Logística Iberia", "Pack Solutions", "TecnoAlmacén", "Distribuciones Centro", "Frío Express"][index % 5],
    legalName: `${["Logística Iberia", "Pack Solutions", "TecnoAlmacén", "Distribuciones Centro", "Frío Express"][index % 5]} S.L.`,
    taxId: `B${pad(70000000 + number, 8)}`,
    contact: ["Laura Martín", "Diego Torres", "Sara Campos", "Miguel Ortega"][index % 4],
    email: `compras${pad(number, 3)}@proveedores.demo`,
    phone: `91 ${pad(2300000 + number, 7)}`,
    country: index % 8 === 0 ? "Portugal" : "España",
    city: ["Madrid", "Barcelona", "Valencia", "Bilbao", "Lisboa"][index % 5],
    leadTimeDays: 1 + (index % 16),
    serviceLevel: `${88 + (index % 13)}%`,
    paymentTerms: ["30 días", "60 días", "Contado", "45 días"][index % 4],
    incoterm: ["DAP", "EXW", "FCA"][index % 3],
    openOrders: index % 11,
    lastOrder: dateAt((index % 38) + 1, 10),
    active: index % 12 === 0 ? "No" : "Sí",
    status: index % 12 === 0 ? "Inactivo" : index % 9 === 0 ? "Revisión" : "Activo",
    updatedAt: dateAt(index % 75, 9),
  };
});

const buildCustomers = (): WorkspaceRow[] => Array.from({ length: 180 }, (_, index) => {
  const number = index + 1;
  return {
    id: `customer-${number}`,
    code: `CLI-${pad(number, 5)}`,
    name: ["Grupo Atlas", "Retail Centro", "Hospital San Lucas", "Market Online", "Norte Industrial", "Farmacias Sol"][index % 6],
    legalName: `Cliente ${pad(number, 4)} S.A.`,
    taxId: `A${pad(30000000 + number, 8)}`,
    channel: ["Retail", "B2B", "E-commerce", "Sanidad", "Industrial"][index % 5],
    segment: ["Premium", "Estándar", "Estratégico"][index % 3],
    contact: ["Lucía Sánchez", "Carlos Romero", "Ana Pérez", "Sin asignar"][index % 4],
    email: `operaciones${pad(number, 3)}@clientes.demo`,
    phone: `93 ${pad(4100000 + number, 7)}`,
    city: ["Madrid", "Barcelona", "Sevilla", "Valencia", "Bilbao"][index % 5],
    country: index % 9 === 0 ? "Francia" : "España",
    serviceLevel: ["24h", "48h", "Programado"][index % 3],
    routes: 1 + (index % 8),
    ordersMonth: 4 + ((index * 13) % 180),
    lastOrder: dateAt(index % 18, 14),
    active: index % 16 === 0 ? "No" : "Sí",
    status: index % 16 === 0 ? "Inactivo" : index % 10 === 0 ? "Pendiente revisión" : "Activo",
    updatedAt: dateAt(index % 60, 10),
  };
});

const buildIntegrations = (): WorkspaceRow[] => Array.from({ length: 52 }, (_, index) => {
  const number = index + 1;
  const status = ["Operativa", "Operativa", "Parcial", "Error", "Programada"][index % 5];
  return {
    id: `integration-${number}`,
    code: `INT-${pad(number, 3)}`,
    name: ["ERP compras", "ERP pedidos", "Transportistas", "Servicio SOAP legado", "Exportación BI", "Lectores RF"][index % 6],
    type: ["Entrada", "Salida", "Bidireccional"][index % 3],
    protocol: ["REST", "SOAP", "SFTP", "WebSocket"][index % 4],
    endpoint: `https://integraciones.demo/api/${index % 6 === 3 ? "soap-stock" : "warehouse"}`,
    direction: ["Inbound", "Outbound", "Bidireccional"][index % 3],
    installation: `MADRID${pad((index % 8) + 1, 2)}`,
    frequency: ["Tiempo real", "Cada 5 min", "Cada hora", "Diaria"][index % 4],
    status,
    lastExecution: dateAt(index % 3, 6 + (index % 12)),
    nextExecution: dateAt(Math.max(0, (index % 2) - 1), 7 + (index % 12)),
    latencyMs: 80 + ((index * 91) % 2400),
    processed: 1200 + ((index * 331) % 98000),
    failed: index % 6 === 3 ? 4 + (index % 28) : index % 9,
    retryPolicy: `${1 + (index % 4)} reintentos / ${5 + (index % 10)} min`,
    version: `v${1 + (index % 3)}.${index % 10}`,
    lastError: status === "Error" ? "Timeout del sistema externo" : null,
    updatedAt: dateAt(index % 25, 11),
  };
});

const buildAudit = (): WorkspaceRow[] => Array.from({ length: 1400 }, (_, index) => {
  const number = index + 1;
  return {
    id: `audit-${number}`,
    eventId: `EVT-${dateAt(index % 60, 8).slice(0, 10).replaceAll("-", "")}-${pad(number, 6)}`,
    occurredAt: dateAt(index % 60, 6 + (index % 13)),
    actor: ["Javier García", "Marta López", "Álvaro Ruiz", "Sistema RF", "Ana Developer"][index % 5],
    role: ["Gestor de almacén", "Gestor de almacén", "Gestor de almacén", "Sistema", "Developer"][index % 5],
    module: ["Stock", "Recepción", "Picking", "Expediciones", "Usuarios", "Integraciones"][index % 6],
    action: ["CONSULTA", "CREACIÓN", "ACTUALIZACIÓN", "CONFIRMACIÓN", "EXPORTACIÓN", "LOGIN"][index % 6],
    entity: ["Stock", "Recepción", "Movimiento", "Usuario", "Configuración"][index % 5],
    entityId: `${["SKU", "RC", "MV", "USR", "CFG"][index % 5]}-${pad(1000 + (index % 9000), 5)}`,
    installation: `MADRID${pad((index % 8) + 1, 2)}`,
    warehouse: index % 3 === 0 ? "MADRID01_FRIO" : "MADRID01_MAIN",
    outcome: index % 19 === 0 ? "Error" : index % 11 === 0 ? "Advertencia" : "Correcto",
    ip: `10.24.${index % 20}.${(index % 240) + 10}`,
    correlationId: `COR-${pad(700000 + number, 8)}`,
    durationMs: 12 + ((index * 37) % 1800),
    details: index % 19 === 0 ? "Respuesta externa no disponible" : "Operación registrada correctamente",
    userAgent: index % 4 === 0 ? "RF-Android" : "Web/SGA",
  };
});

const buildRoles = (): WorkspaceRow[] => Array.from({ length: 12 }, (_, index) => {
  const role = [
    ["WAREHOUSE_MANAGER", "Gestor de almacén", "Operaciones"],
    ["DEVELOPER", "Developer", "Plataforma"],
    ["PRODUCT_OWNER", "Product Owner", "Plataforma"],
    ["RECEIVING_OPERATOR", "Operario de recepción", "Operaciones"],
    ["PICKING_OPERATOR", "Operario de picking", "Operaciones"],
    ["INVENTORY_OPERATOR", "Operario de inventario", "Operaciones"],
  ][index % 6];
  return {
    id: `role-${index + 1}`,
    key: role[0],
    name: role[1],
    scope: role[2],
    users: 2 + ((index * 7) % 36),
    permissions: 8 + ((index * 5) % 34),
    operations: ["Consultar, crear, confirmar", "Administrar plataforma", "Administrar configuración", "Recepción y calidad", "Picking y olas", "Inventario físico"][index % 6],
    installations: index < 3 ? "Todas" : "Asignadas",
    lastReview: dateAt(index % 40, 12),
    active: index === 11 ? "No" : "Sí",
    status: index === 11 ? "Inactivo" : "Activo",
    updatedBy: ["Ana Developer", "Pablo Product Owner"][index % 2],
    updatedAt: dateAt(index % 35, 10),
  };
});

const datasets: Record<WorkspaceResource, WorkspaceRow[]> = {
  stock: buildStock(),
  receipts: buildReceipts(),
  picking: buildPicking(),
  shipments: buildShipments(),
  installations: buildInstallations(),
  locations: buildLocations(),
  movements: buildMovements(),
  inventory: buildInventory(),
  queries: buildQueries(),
  users: buildUsers(),
  products: buildProducts(),
  replenishment: buildReplenishment(),
  suppliers: buildSuppliers(),
  customers: buildCustomers(),
  integrations: buildIntegrations(),
  audit: buildAudit(),
  roles: buildRoles(),
};

export const getWorkspaceRows = (resource: WorkspaceResource) => datasets[resource];
