import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Columns3,
  Download,
  Filter,
  Inbox,
  MoreHorizontal,
  RefreshCw,
  RotateCcw,
  Search,
  Settings2,
  SlidersHorizontal,
  X,
} from "lucide-react";
import type { AuthSession } from "./auth";
import { ErrorFeedback } from "./ErrorFeedback";
import { classifyError, type SupportIncident } from "./error-utils";
import { PageActionsBar, PageActionsConfigurationPanel } from "./PageActions";
import { QueryConfigurationPanel } from "./QueryConfigurationPanel";
import { StockMovementPanel } from "./StockMovementPanel";
import { LocationLabelPrintPanel } from "./LocationLabelPrintPanel";
import { WorkspaceRecordPanel } from "./WorkspaceRecordPanel";
import { localeForLanguage, useI18n } from "./i18n";
import { getDefaultPageActions } from "./page-actions";
import { canManageConfiguration, fetchPageActions, fetchQueryConfiguration, fetchWorkspace, retryIntegrations, runIntegration, saveInstallation, savePageActions, updateWorkspaceRecord, type PageAction, type QueryConfiguration, type QueryConfigurationColumn, type QueryConditionOperator, type WorkspaceResource, type WorkspaceRow, type WorkspaceResponse } from "./workspace";

type TableColumn = { key: string; label: string; width?: string; numeric?: boolean; hiddenByDefault?: boolean; queryConfig?: QueryConfigurationColumn };

const columns: Record<WorkspaceResource, TableColumn[]> = {
  stock: [
    { key: "sku", label: "SKU", width: "w-32" }, { key: "description", label: "Descripción", width: "w-56" }, { key: "lot", label: "Lote", width: "w-28" },
    { key: "serialNumber", label: "Nº serie", width: "w-36", hiddenByDefault: true }, { key: "warehouse", label: "Almacén", width: "w-36" }, { key: "zone", label: "Zona", width: "w-32" },
    { key: "aisle", label: "Pasillo", width: "w-24" }, { key: "bay", label: "Módulo", width: "w-20" }, { key: "level", label: "Nivel", width: "w-20" }, { key: "position", label: "Posición", width: "w-24" },
    { key: "status", label: "Estado", width: "w-28" }, { key: "quantity", label: "Cantidad", width: "w-24", numeric: true }, { key: "available", label: "Disponible", width: "w-24", numeric: true },
    { key: "reserved", label: "Reservado", width: "w-24", numeric: true }, { key: "minimum", label: "Mínimo", width: "w-20", numeric: true }, { key: "unit", label: "Unidad", width: "w-20" },
    { key: "expiry", label: "Caducidad", width: "w-28", hiddenByDefault: true }, { key: "lastMovement", label: "Último movimiento", width: "w-40" }, { key: "supplier", label: "Proveedor", width: "w-40", hiddenByDefault: true },
    { key: "owner", label: "Propietario", width: "w-28", hiddenByDefault: true }, { key: "updatedBy", label: "Actualizado por", width: "w-36", hiddenByDefault: true },
  ],
  receipts: [
    { key: "reference", label: "Recepción", width: "w-32" }, { key: "supplier", label: "Proveedor", width: "w-40" }, { key: "supplierDocument", label: "Albarán", width: "w-32" },
    { key: "purchaseOrder", label: "Pedido compra", width: "w-32" }, { key: "arrivalDate", label: "Llegada", width: "w-40" }, { key: "scheduledDate", label: "Planificada", width: "w-40", hiddenByDefault: true },
    { key: "dock", label: "Muelle", width: "w-20" }, { key: "carrier", label: "Transportista", width: "w-36" }, { key: "warehouse", label: "Almacén", width: "w-36" }, { key: "lines", label: "Líneas", width: "w-20", numeric: true },
    { key: "units", label: "Unidades", width: "w-24", numeric: true }, { key: "priority", label: "Prioridad", width: "w-24" }, { key: "status", label: "Estado", width: "w-28" },
    { key: "receiver", label: "Receptor", width: "w-32" }, { key: "qualityCheck", label: "Calidad", width: "w-28" }, { key: "createdAt", label: "Creada", width: "w-40", hiddenByDefault: true }, { key: "notes", label: "Observaciones", width: "w-56", hiddenByDefault: true },
  ],
  picking: [
    { key: "reference", label: "Picking", width: "w-32" }, { key: "wave", label: "Ola", width: "w-24" }, { key: "order", label: "Pedido", width: "w-32" }, { key: "customer", label: "Cliente", width: "w-44" },
    { key: "route", label: "Ruta", width: "w-24" }, { key: "priority", label: "Prioridad", width: "w-24" }, { key: "zone", label: "Zona", width: "w-32" }, { key: "lines", label: "Líneas", width: "w-20", numeric: true },
    { key: "units", label: "Unidades", width: "w-24", numeric: true }, { key: "progress", label: "Progreso", width: "w-28" }, { key: "picker", label: "Operario", width: "w-36" }, { key: "status", label: "Estado", width: "w-28" },
    { key: "createdAt", label: "Creado", width: "w-40" }, { key: "dueAt", label: "Vencimiento", width: "w-40" }, { key: "startedAt", label: "Inicio", width: "w-40", hiddenByDefault: true }, { key: "carrier", label: "Transportista", width: "w-36", hiddenByDefault: true }, { key: "observations", label: "Observaciones", width: "w-56", hiddenByDefault: true },
  ],
  shipments: [
    { key: "reference", label: "Expedición", width: "w-32" }, { key: "order", label: "Pedido", width: "w-32" }, { key: "customer", label: "Cliente", width: "w-44" }, { key: "shippingDate", label: "Salida", width: "w-40" },
    { key: "dock", label: "Muelle", width: "w-20" }, { key: "route", label: "Ruta", width: "w-24" }, { key: "carrier", label: "Transportista", width: "w-36" }, { key: "tracking", label: "Seguimiento", width: "w-40" },
    { key: "packages", label: "Bultos", width: "w-20", numeric: true }, { key: "units", label: "Unidades", width: "w-24", numeric: true }, { key: "weightKg", label: "Peso (kg)", width: "w-24", numeric: true }, { key: "status", label: "Estado", width: "w-32" },
    { key: "operator", label: "Operario", width: "w-36" }, { key: "service", label: "Servicio", width: "w-28" }, { key: "createdAt", label: "Creada", width: "w-40", hiddenByDefault: true }, { key: "notes", label: "Observaciones", width: "w-56", hiddenByDefault: true },
  ],
  installations: [
    { key: "code", label: "Código", width: "w-28" }, { key: "name", label: "Instalación", width: "w-64" }, { key: "city", label: "Ciudad", width: "w-28" }, { key: "timezone", label: "Zona horaria", width: "w-36", hiddenByDefault: true },
    { key: "warehouses", label: "Almacenes", width: "w-24", numeric: true }, { key: "environment", label: "Entorno", width: "w-32" }, { key: "version", label: "Versión", width: "w-24" }, { key: "status", label: "Estado", width: "w-32" },
    { key: "users", label: "Usuarios", width: "w-24", numeric: true }, { key: "manager", label: "Responsable", width: "w-36" }, { key: "modules", label: "Módulos", width: "w-32" }, { key: "lastSync", label: "Última sincronización", width: "w-44" }, { key: "updatedAt", label: "Actualizada", width: "w-40", hiddenByDefault: true },
  ],
  locations: [
    { key: "code", label: "Ubicación", width: "w-36" }, { key: "warehouse", label: "Almacén", width: "w-36" }, { key: "zone", label: "Zona", width: "w-32" }, { key: "type", label: "Tipo", width: "w-32" },
    { key: "aisle", label: "Pasillo", width: "w-24" }, { key: "bay", label: "Módulo", width: "w-20" }, { key: "level", label: "Nivel", width: "w-20" }, { key: "position", label: "Posición", width: "w-24" },
    { key: "capacity", label: "Capacidad", width: "w-24", numeric: true }, { key: "occupied", label: "Ocupado", width: "w-24", numeric: true }, { key: "utilization", label: "Ocupación", width: "w-24" }, { key: "status", label: "Estado", width: "w-28" },
    { key: "restriction", label: "Restricción", width: "w-40" }, { key: "lastInventory", label: "Último inventario", width: "w-40" }, { key: "updatedBy", label: "Actualizada por", width: "w-36" },
  ],
  movements: [
    { key: "reference", label: "Movimiento", width: "w-32" }, { key: "type", label: "Tipo", width: "w-28" }, { key: "sku", label: "SKU", width: "w-32" }, { key: "lot", label: "Lote", width: "w-28" },
    { key: "origin", label: "Origen", width: "w-36" }, { key: "destination", label: "Destino", width: "w-36" }, { key: "quantity", label: "Cantidad", width: "w-24", numeric: true }, { key: "unit", label: "Unidad", width: "w-20" },
    { key: "operator", label: "Operario", width: "w-36" }, { key: "reason", label: "Motivo", width: "w-44" }, { key: "device", label: "Dispositivo", width: "w-32" }, { key: "status", label: "Estado", width: "w-28" },
    { key: "sourceDocument", label: "Documento", width: "w-32" }, { key: "createdAt", label: "Creado", width: "w-40" }, { key: "confirmedAt", label: "Confirmado", width: "w-40", hiddenByDefault: true }, { key: "observations", label: "Observaciones", width: "w-56", hiddenByDefault: true },
  ],
  inventory: [
    { key: "reference", label: "Inventario", width: "w-32" }, { key: "cycle", label: "Ciclo", width: "w-28" }, { key: "zone", label: "Zona", width: "w-32" }, { key: "location", label: "Ubicación", width: "w-32" },
    { key: "sku", label: "SKU", width: "w-32" }, { key: "description", label: "Descripción", width: "w-52" }, { key: "lot", label: "Lote", width: "w-28" }, { key: "expected", label: "Teórico", width: "w-24", numeric: true },
    { key: "counted", label: "Contado", width: "w-24", numeric: true }, { key: "difference", label: "Diferencia", width: "w-24", numeric: true }, { key: "status", label: "Estado", width: "w-36" }, { key: "counter", label: "Contador", width: "w-36" },
    { key: "countedAt", label: "Fecha conteo", width: "w-40" }, { key: "recheck", label: "Recuento", width: "w-24" }, { key: "approvedBy", label: "Aprobado por", width: "w-36", hiddenByDefault: true }, { key: "lastCount", label: "Último conteo", width: "w-40", hiddenByDefault: true }, { key: "notes", label: "Notas", width: "w-48", hiddenByDefault: true },
  ],
  queries: [
    { key: "code", label: "Código", width: "w-24" }, { key: "name", label: "Consulta", width: "w-56" }, { key: "category", label: "Categoría", width: "w-32" }, { key: "source", label: "Origen", width: "w-28" },
    { key: "columns", label: "Columnas", width: "w-24", numeric: true }, { key: "filters", label: "Filtros", width: "w-20", numeric: true }, { key: "lastRun", label: "Última ejecución", width: "w-40" }, { key: "durationMs", label: "Duración ms", width: "w-28", numeric: true },
    { key: "executions", label: "Ejecuciones", width: "w-28", numeric: true }, { key: "owner", label: "Propietario", width: "w-36" }, { key: "visibility", label: "Visibilidad", width: "w-28" }, { key: "status", label: "Estado", width: "w-28" }, { key: "updatedAt", label: "Actualizada", width: "w-40" },
  ],
  users: [
    { key: "username", label: "Usuario", width: "w-32" }, { key: "displayName", label: "Nombre", width: "w-44" }, { key: "email", label: "Correo", width: "w-56" }, { key: "role", label: "Rol", width: "w-36" },
    { key: "installation", label: "Instalación", width: "w-32" }, { key: "warehouse", label: "Almacén", width: "w-36" }, { key: "status", label: "Estado", width: "w-28" }, { key: "lastAccess", label: "Último acceso", width: "w-40" },
    { key: "sessions", label: "Sesiones", width: "w-24", numeric: true }, { key: "modules", label: "Módulos", width: "w-28" }, { key: "createdAt", label: "Alta", width: "w-40", hiddenByDefault: true }, { key: "updatedAt", label: "Actualizado", width: "w-40", hiddenByDefault: true },
  ],
  products: [
    { key: "sku", label: "SKU", width: "w-32" }, { key: "gtin", label: "GTIN", width: "w-36", hiddenByDefault: true }, { key: "description", label: "Descripción", width: "w-56" }, { key: "family", label: "Familia", width: "w-32" },
    { key: "category", label: "Categoría", width: "w-32" }, { key: "brand", label: "Marca", width: "w-32" }, { key: "unit", label: "Unidad", width: "w-20" }, { key: "packSize", label: "Pack", width: "w-20", numeric: true },
    { key: "weightKg", label: "Peso kg", width: "w-24", numeric: true }, { key: "dimensions", label: "Dimensiones", width: "w-36", hiddenByDefault: true }, { key: "lotRequired", label: "Lote", width: "w-20" }, { key: "expiryRequired", label: "Caducidad", width: "w-24" },
    { key: "serialRequired", label: "Nº serie", width: "w-24" }, { key: "supplier", label: "Proveedor", width: "w-40" }, { key: "minStock", label: "Mínimo", width: "w-24", numeric: true }, { key: "maxStock", label: "Máximo", width: "w-24", numeric: true },
    { key: "leadTimeDays", label: "Plazo días", width: "w-24", numeric: true }, { key: "active", label: "Activo", width: "w-20" }, { key: "status", label: "Estado", width: "w-28" }, { key: "updatedAt", label: "Actualizado", width: "w-40", hiddenByDefault: true }, { key: "updatedBy", label: "Actualizado por", width: "w-36", hiddenByDefault: true },
  ],
  replenishment: [
    { key: "reference", label: "Reposición", width: "w-32" }, { key: "wave", label: "Ola", width: "w-32" }, { key: "sku", label: "SKU", width: "w-32" }, { key: "description", label: "Descripción", width: "w-52" },
    { key: "sourceLocation", label: "Origen", width: "w-36" }, { key: "targetLocation", label: "Destino", width: "w-36" }, { key: "current", label: "Actual", width: "w-20", numeric: true }, { key: "minimum", label: "Mínimo", width: "w-20", numeric: true },
    { key: "suggested", label: "Sugerida", width: "w-24", numeric: true }, { key: "quantity", label: "Cantidad", width: "w-24", numeric: true }, { key: "unit", label: "Unidad", width: "w-20" }, { key: "priority", label: "Prioridad", width: "w-24" },
    { key: "status", label: "Estado", width: "w-28" }, { key: "operator", label: "Operario", width: "w-36" }, { key: "reason", label: "Motivo", width: "w-44", hiddenByDefault: true }, { key: "route", label: "Ruta", width: "w-24", hiddenByDefault: true },
    { key: "createdAt", label: "Creada", width: "w-40" }, { key: "dueAt", label: "Vencimiento", width: "w-40" }, { key: "confirmedAt", label: "Confirmada", width: "w-40", hiddenByDefault: true }, { key: "observations", label: "Observaciones", width: "w-52", hiddenByDefault: true },
  ],
  suppliers: [
    { key: "code", label: "Código", width: "w-28" }, { key: "name", label: "Proveedor", width: "w-48" }, { key: "legalName", label: "Razón social", width: "w-52", hiddenByDefault: true }, { key: "taxId", label: "NIF", width: "w-32" },
    { key: "contact", label: "Contacto", width: "w-36" }, { key: "email", label: "Correo", width: "w-52" }, { key: "phone", label: "Teléfono", width: "w-32" }, { key: "country", label: "País", width: "w-28" },
    { key: "city", label: "Ciudad", width: "w-28" }, { key: "leadTimeDays", label: "Plazo días", width: "w-24", numeric: true }, { key: "serviceLevel", label: "Nivel servicio", width: "w-28" }, { key: "paymentTerms", label: "Pago", width: "w-24" },
    { key: "incoterm", label: "Incoterm", width: "w-24" }, { key: "openOrders", label: "Pedidos abiertos", width: "w-32", numeric: true }, { key: "lastOrder", label: "Último pedido", width: "w-40" }, { key: "active", label: "Activo", width: "w-20" }, { key: "status", label: "Estado", width: "w-28" }, { key: "updatedAt", label: "Actualizado", width: "w-40", hiddenByDefault: true },
  ],
  customers: [
    { key: "code", label: "Código", width: "w-28" }, { key: "name", label: "Cliente", width: "w-48" }, { key: "legalName", label: "Razón social", width: "w-48", hiddenByDefault: true }, { key: "taxId", label: "NIF", width: "w-32" },
    { key: "channel", label: "Canal", width: "w-28" }, { key: "segment", label: "Segmento", width: "w-28" }, { key: "contact", label: "Contacto", width: "w-36" }, { key: "email", label: "Correo", width: "w-52" },
    { key: "phone", label: "Teléfono", width: "w-32" }, { key: "city", label: "Ciudad", width: "w-28" }, { key: "country", label: "País", width: "w-28" }, { key: "serviceLevel", label: "Servicio", width: "w-28" },
    { key: "routes", label: "Rutas", width: "w-20", numeric: true }, { key: "ordersMonth", label: "Pedidos/mes", width: "w-28", numeric: true }, { key: "lastOrder", label: "Último pedido", width: "w-40" }, { key: "active", label: "Activo", width: "w-20" }, { key: "status", label: "Estado", width: "w-36" }, { key: "updatedAt", label: "Actualizado", width: "w-40", hiddenByDefault: true },
  ],
  integrations: [
    { key: "code", label: "Código", width: "w-24" }, { key: "name", label: "Integración", width: "w-48" }, { key: "type", label: "Tipo", width: "w-28" }, { key: "protocol", label: "Protocolo", width: "w-28" },
    { key: "endpoint", label: "Endpoint", width: "w-64", hiddenByDefault: true }, { key: "direction", label: "Dirección", width: "w-32" }, { key: "installation", label: "Instalación", width: "w-32" }, { key: "frequency", label: "Frecuencia", width: "w-28" },
    { key: "status", label: "Estado", width: "w-28" }, { key: "lastExecution", label: "Última ejecución", width: "w-40" }, { key: "nextExecution", label: "Siguiente", width: "w-40", hiddenByDefault: true }, { key: "latencyMs", label: "Latencia ms", width: "w-28", numeric: true },
    { key: "processed", label: "Procesados", width: "w-28", numeric: true }, { key: "failed", label: "Fallidos", width: "w-24", numeric: true }, { key: "retryPolicy", label: "Reintentos", width: "w-32", hiddenByDefault: true }, { key: "version", label: "Versión", width: "w-24" },
    { key: "lastError", label: "Último error", width: "w-52", hiddenByDefault: true }, { key: "updatedAt", label: "Actualizada", width: "w-40", hiddenByDefault: true },
  ],
  audit: [
    { key: "eventId", label: "Evento", width: "w-40" }, { key: "occurredAt", label: "Fecha y hora", width: "w-40" }, { key: "actor", label: "Actor", width: "w-36" }, { key: "role", label: "Rol", width: "w-36" },
    { key: "module", label: "Módulo", width: "w-32" }, { key: "action", label: "Acción", width: "w-32" }, { key: "entity", label: "Entidad", width: "w-32" }, { key: "entityId", label: "Id entidad", width: "w-36" },
    { key: "installation", label: "Instalación", width: "w-32" }, { key: "warehouse", label: "Almacén", width: "w-36" }, { key: "outcome", label: "Resultado", width: "w-28" }, { key: "ip", label: "IP", width: "w-32", hiddenByDefault: true },
    { key: "correlationId", label: "Correlación", width: "w-36", hiddenByDefault: true }, { key: "durationMs", label: "Duración ms", width: "w-28", numeric: true }, { key: "details", label: "Detalle", width: "w-56" }, { key: "userAgent", label: "Cliente", width: "w-32", hiddenByDefault: true },
  ],
  roles: [
    { key: "key", label: "Clave", width: "w-36" }, { key: "name", label: "Rol", width: "w-48" }, { key: "scope", label: "Ámbito", width: "w-32" }, { key: "users", label: "Usuarios", width: "w-24", numeric: true },
    { key: "permissions", label: "Permisos", width: "w-24", numeric: true }, { key: "operations", label: "Operaciones", width: "w-64" }, { key: "installations", label: "Instalaciones", width: "w-32" }, { key: "lastReview", label: "Última revisión", width: "w-40" },
    { key: "active", label: "Activo", width: "w-20" }, { key: "status", label: "Estado", width: "w-28" }, { key: "updatedBy", label: "Actualizado por", width: "w-36" }, { key: "updatedAt", label: "Actualizado", width: "w-40", hiddenByDefault: true },
  ],
};

const columnLabels: Record<string, string> = {
  action: "Acción", active: "Activo", actor: "Actor", aisle: "Pasillo", approvedBy: "Aprobado por", arrivalDate: "Llegada", available: "Disponible", bay: "Módulo", brand: "Marca", capacity: "Capacidad", carrier: "Transportista", category: "Categoría", channel: "Canal", city: "Ciudad", code: "Código", columns: "Columnas", confirmedAt: "Confirmado", contact: "Contacto", correlationId: "ID de correlación", counted: "Contado", countedAt: "Fecha de conteo", counter: "Contador", country: "País", createdAt: "Creado", current: "Actual", customer: "Cliente", cycle: "Ciclo", description: "Descripción", destination: "Destino", details: "Detalles", device: "Dispositivo", difference: "Diferencia", dimensions: "Dimensiones", direction: "Dirección", displayName: "Nombre visible", dock: "Muelle", dueAt: "Vencimiento", durationMs: "Duración (ms)", email: "Correo electrónico", endpoint: "Endpoint", entity: "Entidad", entityId: "ID de entidad", environment: "Entorno", eventId: "ID de evento", executions: "Ejecuciones", expected: "Esperado", expiry: "Caducidad", expiryRequired: "Caducidad obligatoria", failed: "Fallidas", family: "Familia", filters: "Filtros", frequency: "Frecuencia", gtin: "GTIN", id: "ID", incoterm: "Incoterm", installation: "Instalación", installations: "Instalaciones", ip: "IP", key: "Clave", lastAccess: "Último acceso", lastCount: "Último conteo", lastError: "Último error", lastExecution: "Última ejecución", lastInventory: "Último inventario", lastMovement: "Último movimiento", lastOrder: "Último pedido", lastReview: "Última revisión", lastRun: "Última ejecución", lastSync: "Última sincronización", latencyMs: "Latencia (ms)", leadTimeDays: "Plazo (días)", legalName: "Razón social", level: "Nivel", lines: "Líneas", location: "Ubicación", lot: "Lote", lotRequired: "Lote obligatorio", manager: "Responsable", maxStock: "Stock máximo", minimum: "Mínimo", minStock: "Stock mínimo", module: "Módulo", modules: "Módulos", name: "Nombre", nextExecution: "Próxima ejecución", notes: "Notas", observations: "Observaciones", occupied: "Ocupado", occurredAt: "Ocurrido", openOrders: "Pedidos abiertos", operations: "Operaciones", operator: "Operario", order: "Pedido", ordersMonth: "Pedidos del mes", origin: "Origen", outcome: "Resultado", owner: "Propietario", packages: "Bultos", packSize: "Formato", paymentTerms: "Condiciones de pago", permissions: "Permisos", phone: "Teléfono", picker: "Preparador", position: "Posición", priority: "Prioridad", processed: "Procesados", progress: "Progreso", protocol: "Protocolo", purchaseOrder: "Pedido de compra", qualityCheck: "Control de calidad", quantity: "Cantidad", reason: "Motivo", receiver: "Receptor", recheck: "Revisión", reference: "Referencia", reserved: "Reservado", restriction: "Restricción", retryPolicy: "Política de reintento", role: "Rol", route: "Ruta", routes: "Rutas", scheduledDate: "Planificada", scope: "Ámbito", segment: "Segmento", serialNumber: "Nº serie", serialRequired: "Serie obligatoria", service: "Servicio", serviceLevel: "Nivel de servicio", sessions: "Sesiones", shippingDate: "Salida", sku: "SKU", source: "Origen", sourceDocument: "Documento origen", sourceLocation: "Ubicación origen", startedAt: "Inicio", status: "Estado", suggested: "Sugerido", supplier: "Proveedor", supplierDocument: "Albarán", targetLocation: "Ubicación destino", taxId: "NIF", timezone: "Zona horaria", tracking: "Seguimiento", type: "Tipo", unit: "Unidad", units: "Unidades", updatedAt: "Actualizado", updatedBy: "Actualizado por", userAgent: "Navegador", username: "Usuario", users: "Usuarios", utilization: "Ocupación", version: "Versión", visibility: "Visibilidad", warehouse: "Almacén", warehouses: "Almacenes", wave: "Ola", weightKg: "Peso (kg)", zone: "Zona",
};

const fallbackColumnLabel = (key: string) => key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (letter) => letter.toUpperCase());

const titles: Record<WorkspaceResource, { title: string; eyebrow: string; description: string; action: string }> = {
  stock: { title: "Stock y existencias", eyebrow: "Inventario", description: "Consulta operativa de existencias por ubicación, lote, estado y disponibilidad.", action: "Nuevo movimiento" },
  receipts: { title: "Recepciones", eyebrow: "Operaciones", description: "Entradas planificadas, descargas y controles de calidad del almacén.", action: "Nueva recepción" },
  picking: { title: "Tareas de picking", eyebrow: "Operaciones", description: "Seguimiento de olas, pedidos, operarios y avance de preparación.", action: "Crear ola" },
  shipments: { title: "Expediciones", eyebrow: "Operaciones", description: "Salidas, muelles, transportistas y trazabilidad de entrega.", action: "Nueva expedición" },
  installations: { title: "Instalaciones", eyebrow: "Administración", description: "Configuración de centros, almacenes, entornos y módulos habilitados.", action: "Nueva instalación" },
  locations: { title: "Ubicaciones", eyebrow: "Inventario", description: "Mapa operativo de posiciones, capacidad, ocupación y restricciones del almacén.", action: "Nueva ubicación" },
  movements: { title: "Movimientos", eyebrow: "Operaciones", description: "Trazabilidad de entradas, salidas, reposiciones, traspasos y ajustes.", action: "Nuevo movimiento" },
  inventory: { title: "Inventario físico", eyebrow: "Inventario", description: "Conteos cíclicos, diferencias, recuentos y aprobación de ajustes.", action: "Nuevo conteo" },
  queries: { title: "Consultas guardadas", eyebrow: "Consultas", description: "Consultas parametrizadas, tiempos de ejecución, visibilidad y uso por instalación.", action: "Nueva consulta" },
  users: { title: "Usuarios y roles", eyebrow: "Administración", description: "Usuarios asignados a instalaciones, roles, sesiones y módulos disponibles.", action: "Nuevo usuario" },
  products: { title: "Maestro de artículos", eyebrow: "Inventario", description: "Catálogo de artículos, trazabilidad, unidades logísticas, mínimos y reglas de almacenamiento.", action: "Nuevo artículo" },
  replenishment: { title: "Reposición", eyebrow: "Inventario", description: "Tareas sugeridas para mantener las ubicaciones de picking abastecidas y operativas.", action: "Nueva reposición" },
  suppliers: { title: "Proveedores", eyebrow: "Maestros", description: "Datos de proveedores, plazos de entrega, nivel de servicio y pedidos abiertos.", action: "Nuevo proveedor" },
  customers: { title: "Clientes", eyebrow: "Maestros", description: "Clientes, canales, niveles de servicio, rutas y actividad de pedidos.", action: "Nuevo cliente" },
  integrations: { title: "Integraciones", eyebrow: "Administración", description: "Conectores con ERP, transportistas, servicios legados y lectores del almacén.", action: "Nueva integración" },
  audit: { title: "Auditoría", eyebrow: "Sistema", description: "Trazabilidad detallada de acciones, actores, módulos, resultados y correlaciones técnicas.", action: "Exportar auditoría" },
  roles: { title: "Roles y permisos", eyebrow: "Administración", description: "Matriz de roles, permisos, ámbito operativo y alcance por instalación.", action: "Nuevo rol" },
};

const configurableResources = new Set<WorkspaceResource>(["stock", "receipts", "picking", "shipments", "inventory", "movements", "queries", "locations", "products", "replenishment", "suppliers", "customers", "users", "roles", "integrations"]);

const formatValue = (value: string | number | null | undefined) => {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "number") return new Intl.NumberFormat("es-ES").format(value);
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:/.test(value)) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(date);
  }
  return value;
};

const matchesCondition = (value: string | number | null | undefined, operator: QueryConditionOperator, expected: string | number) => {
  const actualText = String(value ?? "").toLowerCase();
  const expectedText = String(expected).toLowerCase();
  const actualNumber = Number(value);
  const expectedNumber = Number(expected);
  if (["gt", "gte", "lt", "lte"].includes(operator) && !Number.isNaN(actualNumber) && !Number.isNaN(expectedNumber)) {
    if (operator === "gt") return actualNumber > expectedNumber;
    if (operator === "gte") return actualNumber >= expectedNumber;
    if (operator === "lt") return actualNumber < expectedNumber;
    return actualNumber <= expectedNumber;
  }
  if (operator === "contains") return actualText.includes(expectedText);
  if (operator === "neq") return actualText !== expectedText;
  return actualText === expectedText;
};

const getCellPresentation = (value: string | number | null | undefined, column: TableColumn) => {
  const config = column.queryConfig;
  const type = config?.type ?? (column.numeric ? "number" : "text");
  const numberValue = typeof value === "number" ? value : Number(value);
  const hasNumber = value !== null && value !== undefined && value !== "" && !Number.isNaN(numberValue);
  const decimals = config?.decimals ?? (type === "percentage" ? 1 : 0);
  let text = formatValue(value);
  if (type === "percentage" && hasNumber) {
    const percentage = Math.abs(numberValue) <= 1 ? numberValue * 100 : numberValue;
    text = `${new Intl.NumberFormat("es-ES", { maximumFractionDigits: decimals }).format(percentage)}${config?.suffix ?? "%"}`;
  } else if (type === "currency" && hasNumber) {
    text = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: decimals }).format(numberValue);
  } else if (type === "number" && hasNumber) {
    text = new Intl.NumberFormat("es-ES", { maximumFractionDigits: decimals }).format(numberValue);
  }
  const condition = config?.conditions?.find((item) => matchesCondition(value, item.operator, item.value));
  const background = condition?.background ?? config?.background;
  const textColor = condition?.textColor ?? config?.textColor;
  const percentageValue = type === "percentage" && hasNumber ? Math.max(0, Math.min(100, Math.abs(numberValue) <= 1 ? numberValue * 100 : numberValue)) : null;
  return { text, background, textColor, badge: config?.badge === true || type === "status", percentageValue };
};

const statusClass = (value: string) => {
  if (["Completada", "Completado", "Disponible", "Activa", "Activo", "Conforme", "Confirmado", "Expedido", "Cargado", "Publicada", "Operativa", "Correcto", "Asignada"].includes(value)) return "bg-emerald-50 text-emerald-700";
  if (["Incidencia", "Bloqueado", "Bloqueada", "Mantenimiento", "Urgente", "Con diferencia", "Error", "Bloqueada", "Inactivo"].includes(value)) return "bg-red-50 text-red-700";
  if (["En curso", "En descarga", "En tránsito", "Preparando", "Parcial", "Listo para cargar", "Reservado", "Ocupada", "En curso", "Advertencia", "Revisión"].includes(value)) return "bg-blue-50 text-blue-700";
  return "bg-amber-50 text-amber-700";
};

export function WarehouseModule({ resource, session, onNavigate, onReportError }: { resource: WorkspaceResource; session: AuthSession; onNavigate?: (resource: WorkspaceResource) => void; onReportError?: (incident: SupportIncident) => void }) {
  const { language, t } = useI18n();
  const definition = titles[resource] ?? { title: "Módulo", eyebrow: "SGA", description: "Sección del sistema", action: "Acción" };
  const availableColumns = columns[resource] ?? [];
  const [queryConfiguration, setQueryConfiguration] = useState<QueryConfiguration | null>(null);
  const [response, setResponse] = useState<WorkspaceResponse | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(35);
  const [sortBy, setSortBy] = useState(availableColumns[0]?.key ?? "id");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedRow, setSelectedRow] = useState<WorkspaceRow | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [visibleKeys, setVisibleKeys] = useState(() => availableColumns.filter((column) => !column.hiddenByDefault).map((column) => column.key));
  const [density, setDensity] = useState<"comfortable" | "compact">("comfortable");
  const [showColumns, setShowColumns] = useState(false);
  const [refreshIndex, setRefreshIndex] = useState(0);
  const [editedRows, setEditedRows] = useState<Record<string, WorkspaceRow>>({});
  const [showQueryConfiguration, setShowQueryConfiguration] = useState(false);
  const [showStockMovement, setShowStockMovement] = useState(false);
  const [showWorkspaceRecord, setShowWorkspaceRecord] = useState(false);
  const [showLocationLabelPrint, setShowLocationLabelPrint] = useState(false);
  const [pageActions, setPageActions] = useState<PageAction[]>(() => getDefaultPageActions(resource));
  const [showPageActions, setShowPageActions] = useState(false);
  const [actionMessage, setActionMessage] = useState("");
  const [actionError, setActionError] = useState<SupportIncident | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const timer = window.setTimeout(() => {
      fetchWorkspace(resource, session.token, { search, status, page, pageSize, sortBy, sortDir })
        .then((nextResponse) => { if (active) { setResponse(nextResponse); setError(""); } })
        .catch((nextError) => { if (active) { setResponse(null); setSelectedRow(null); setSelectedIds([]); setError(nextError instanceof Error ? nextError.message : "No se pudo cargar la tabla"); } })
        .finally(() => { if (active) setLoading(false); });
    }, search ? 220 : 0);
    return () => { active = false; window.clearTimeout(timer); };
  }, [resource, session.token, search, status, page, pageSize, sortBy, sortDir, refreshIndex]);

  useEffect(() => {
    let active = true;
    setQueryConfiguration(null);
    if (!configurableResources.has(resource)) return () => { active = false; };
    fetchQueryConfiguration(resource, session.token)
      .then((nextConfiguration) => { if (active) { setQueryConfiguration(nextConfiguration); setVisibleKeys(nextConfiguration.columns.filter((column) => column.visible).map((column) => column.key)); } })
      .catch(() => { if (active) setQueryConfiguration(null); });
    return () => { active = false; };
  }, [resource, session.token]);

  useEffect(() => {
    let active = true;
    setPageActions(getDefaultPageActions(resource));
    fetchPageActions(resource, session.token)
      .then((configuration) => { if (active && configuration.id) setPageActions(configuration.actions); })
      .catch(() => { if (active) setPageActions(getDefaultPageActions(resource)); });
    return () => { active = false; };
  }, [resource, session.token]);

  useEffect(() => {
    setPage(1);
    setSelectedRow(null);
    setSelectedIds([]);
    setVisibleKeys(availableColumns.filter((column) => !column.hiddenByDefault).map((column) => column.key));
    setEditedRows({});
  }, [resource]);

  useEffect(() => {
    setSelectedIds([]);
  }, [resource, page, pageSize, search, status, sortBy, sortDir]);

  const statusOptions = useMemo(() => response?.availableStatuses ?? [], [response]);
  const rows = (response?.items ?? []).map((row) => editedRows[row.id] ?? row);
  const selectedRows = rows.filter((row) => selectedIds.includes(row.id));
  const allVisibleRowsSelected = rows.length > 0 && rows.every((row) => selectedIds.includes(row.id));
  const configuredColumns = useMemo(() => {
    const configured = availableColumns.map((column) => {
    const config = queryConfiguration?.columns.find((item) => item.key === column.key);
    return config ? { ...column, label: config.label || column.label, numeric: ["number", "percentage", "currency"].includes(config.type), queryConfig: config } : column;
    });
    const extraColumns = (queryConfiguration?.columns ?? []).filter((config) => !availableColumns.some((column) => column.key === config.key)).map((config) => ({ key: config.key, label: config.label || config.key, width: "w-40", numeric: ["number", "percentage", "currency"].includes(config.type), queryConfig: config }));
    return [...configured, ...extraColumns];
  }, [availableColumns, queryConfiguration]);
  const localizedColumns = useMemo(() => configuredColumns.map((column) => ({ ...column, label: t(columnLabels[column.key] ?? fallbackColumnLabel(column.key)) })), [configuredColumns, t]);
  const localizedActions = useMemo(() => pageActions.map((action) => ({ ...action, label: t(action.label) })), [pageActions, t]);
  const localizedDefinition = { ...definition, title: t(definition.title), eyebrow: t(definition.eyebrow), description: t(definition.description) };
  const canEditInstallations = resource === "installations" && canManageConfiguration(session.role.key);
  const canConfigureQuery = configurableResources.has(resource) && canManageConfiguration(session.role.key);
  const canConfigureActions = canManageConfiguration(session.role.key);
  const hasActiveFilters = search.trim().length > 0 || status !== "all";

  const handleSort = (key: string) => {
    if (sortBy === key) setSortDir((direction) => direction === "asc" ? "desc" : "asc");
    else { setSortBy(key); setSortDir("asc"); }
  };

  const exportCsv = () => {
    const header = visibleKeys.map((key) => localizedColumns.find((column) => column.key === key)?.label ?? key).join(",");
    const body = rows.map((row) => visibleKeys.map((key) => JSON.stringify(row[key] ?? "")).join(",")).join("\n");
    const blob = new Blob([`${header}\n${body}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a"); link.href = url; link.download = `${resource}-demo.csv`; link.click(); URL.revokeObjectURL(url);
  };

  const handlePageAction = (action: PageAction) => {
    setActionMessage("");
    setActionError(null);
    if (action.actionType === "export") {
      exportCsv();
      setActionMessage(`${t("Exportación iniciada para")} ${localizedDefinition.title.toLowerCase()}.`);
      return;
    }
    if (action.actionType === "navigation" && action.targetResource && onNavigate) {
      onNavigate(action.targetResource);
      return;
    }
    if (action.id === "new-stock-movement") {
      setShowStockMovement(true);
      return;
    }

    if (action.id === "adjust-stock") {
      setShowStockMovement(true);
      return;
    }
    if (action.id === "new-installation") {
      setSelectedRow({ id: "new", code: "", name: "", city: "Madrid", timezone: "Europe/Madrid", warehouses: 1, environment: "Preproducción", version: "0.1.0", status: "Activa", users: 0, manager: "", modules: "", lastSync: "", updatedAt: "" });
      return;
    }
    if (action.id === "print-location-labels") {
      setShowLocationLabelPrint(true);
      return;
    }

    if (action.id === "test-query") {
      setShowQueryConfiguration(true);
      return;
    }
    const statusOperations: Record<string, { status: string; extra?: Record<string, string | number> }> = {
      "validate-receipt": { status: "Completada", extra: { qualityCheck: "Conforme" } },
      "assign-picker": { status: "En curso", extra: { picker: session.user.displayName, progress: 1 } },
      "start-picking": { status: "En curso", extra: { startedAt: new Date().toISOString(), progress: 1 } },
      "confirm-load": { status: "Cargado" },
      "approve-differences": { status: "Conforme", extra: { approvedBy: session.user.displayName } },
      "assign-replenishment": { status: "Asignada", extra: { operator: session.user.displayName } },
      "confirm-movement": { status: "Confirmado" },
    };
    const statusOperation = statusOperations[action.id];
    if (statusOperation) {
      const targets = action.id === "confirm-movement"
        ? selectedRows
        : selectedRows.length > 0 ? selectedRows : selectedRow ? [selectedRow] : rows.slice(0, 1);
      if (!targets.length) { setActionMessage("Selecciona al menos un registro antes de ejecutar esta operación."); return; }
      setActionBusy(true);
      void Promise.all(targets.map((target) => updateWorkspaceRecord(resource, session.token, target.id, { status: statusOperation.status, ...(statusOperation.extra ?? {}) }))).then(() => {
        setActionMessage(`${t(action.label)} ${t("completado para")} ${targets.length} ${t(targets.length === 1 ? "registro" : "registros")}.`);
        setSelectedRow(null);
        setSelectedIds([]);
        setRefreshIndex((value) => value + 1);
      }).catch((error) => { const incident = classifyError(error, "No se pudo ejecutar la operación"); setActionError({ ...incident, resource, action: action.label }); onReportError?.({ ...incident, resource, action: action.label }); }).finally(() => setActionBusy(false));
      return;
    }
    if (["new-receipt", "new-picking-wave", "new-shipment", "new-location", "new-movement", "new-inventory-count", "generate-replenishment", "new-product", "new-supplier", "new-customer", "new-query", "new-user", "new-role"].includes(action.id)) {
      setShowWorkspaceRecord(true);
      return;
    }
    if (action.id === "run-integration") {
      const firstIntegration = rows[0];
      if (!firstIntegration) { setActionMessage(t("No hay integraciones disponibles para ejecutar.")); return; }
      setActionBusy(true);
      void runIntegration(session.token, String(firstIntegration.id)).then(() => { setActionMessage(t("Integración ejecutada correctamente.")); setRefreshIndex((value) => value + 1); }).catch((error) => { const incident = classifyError(error, t("No se pudo ejecutar la integración")); setActionError({ ...incident, resource, action: action.label }); onReportError?.({ ...incident, resource, action: action.label }); }).finally(() => setActionBusy(false));
      return;
    }
    if (action.id === "retry-integration") {
      setActionBusy(true);
      void retryIntegrations(session.token).then((result) => { setActionMessage(`${result.updated ?? 0} ${t("integraciones reintentadas.")}`); setRefreshIndex((value) => value + 1); }).catch((error) => { const incident = classifyError(error, t("No se pudieron reintentar las integraciones")); setActionError({ ...incident, resource, action: action.label }); onReportError?.({ ...incident, resource, action: action.label }); }).finally(() => setActionBusy(false));
      return;
    }
    setActionMessage(`${t("Acción preparada para")} ${localizedDefinition.title.toLowerCase()}: «${t(action.label)}».`);
  };

  if (!titles[resource] || !columns[resource]?.length) {
    return <section className="rounded-xl border border-amber-200 bg-amber-50 p-8 text-center"><h1 className="text-lg font-bold text-amber-900">Módulo no disponible</h1><p className="mt-2 text-sm text-amber-800">Esta sección todavía no tiene una configuración de tabla asociada.</p></section>;
  }

  return (
    <div className="space-y-5">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-brand">{localizedDefinition.eyebrow}</p><h1 className="mt-1 text-3xl font-bold tracking-tight text-ink">{localizedDefinition.title}</h1><p className="mt-1 max-w-3xl text-sm text-slate-500">{localizedDefinition.description}</p></div>
        <div className="flex items-center gap-2">{!error && <span className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-500">{response?.generatedRows ? `${new Intl.NumberFormat(localeForLanguage[language]).format(response.generatedRows)} ${t(resource === "stock" ? "existencias" : "registros")}` : t("Cargando registros…")}</span>}{queryConfiguration?.status === "PUBLISHED" && <span className="rounded-full bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">{t("Vista v")}{queryConfiguration.version}</span>}{canConfigureQuery && <button type="button" onClick={() => setShowQueryConfiguration(true)} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"><Settings2 size={16} />{t("Configurar vista")}</button>}</div>
      </section>

      <PageActionsBar actions={localizedActions} roleKey={session.role.key} canConfigure={canConfigureActions} busy={actionBusy} onAction={handlePageAction} onConfigure={() => setShowPageActions(true)} />
      {selectedIds.length > 0 && <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900"><span><strong>{selectedIds.length}</strong> {t(selectedIds.length === 1 ? "registro seleccionado" : "registros seleccionados")} {t("para operaciones")}</span><button type="button" onClick={() => setSelectedIds([])} className="font-semibold text-brand hover:text-blue-700">{t("Limpiar selección")}</button></div>}
      {actionBusy && <div role="status" className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">{t("Procesando operación…")}</div>}
      {actionMessage && <div role="status" className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">{actionMessage}</div>}
      {actionError && <ErrorFeedback incident={actionError} onOpenSupport={onReportError} compact />}

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-panel">
        <div className="flex flex-wrap items-center gap-3">
          <label className="relative min-w-[260px] flex-1"><Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" /><span className="sr-only">{t("Buscar en")} {localizedDefinition.title}</span><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm text-ink outline-none transition focus:border-brand focus:bg-white focus:ring-4 focus:ring-blue-100" placeholder={t("Buscar por referencia, SKU, ubicación, proveedor…")} /></label>
          <div className="flex items-center gap-2"><Filter size={16} className="text-slate-400" /><select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-brand"><option value="all">{t("Todos los estados")}</option>{statusOptions.map((option) => <option key={option} value={option}>{t(option)}</option>)}</select></div>
          <div className="relative"><button type="button" onClick={() => setShowColumns((visible) => !visible)} aria-expanded={showColumns} className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-600 hover:bg-slate-50"><Columns3 size={16} />{t("Columnas")}</button>{showColumns && <div className="absolute right-0 top-12 z-20 w-64 rounded-xl border border-slate-200 bg-white p-3 shadow-xl"><p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">{t("Columnas visibles")}</p>{localizedColumns.map((column) => <label key={column.key} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-slate-600 hover:bg-slate-50"><input type="checkbox" checked={visibleKeys.includes(column.key)} disabled={visibleKeys.length === 1 && visibleKeys.includes(column.key)} onChange={() => setVisibleKeys((keys) => keys.includes(column.key) ? keys.filter((key) => key !== column.key) : [...keys, column.key])} />{column.label}</label>)}</div>}</div>
          <button type="button" onClick={() => setDensity((current) => current === "compact" ? "comfortable" : "compact")} className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-600 hover:bg-slate-50"><SlidersHorizontal size={16} />{t(density === "compact" ? "Cómoda" : "Densa")}</button>
          <button type="button" onClick={() => setRefreshIndex((value) => value + 1)} className="grid h-10 w-10 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50" aria-label={t("Actualizar datos")}><RefreshCw size={16} /></button>
          <button type="button" onClick={exportCsv} className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-600 hover:bg-slate-50"><Download size={16} />{t("Exportar")}</button>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs text-slate-400"><span>{t("Filtros aplicados")}: {search || status !== "all" ? t("sí") : t("ninguno")} · {t("Actualización bajo demanda")}</span><span>{t("Haz clic en una fila para ver todos sus campos")}</span></div>
      </section>

      {error && <ErrorFeedback incident={{ ...classifyError(new Error(error), "No se pudo cargar la tabla"), resource }} onRetry={() => setRefreshIndex((value) => value + 1)} onOpenSupport={onReportError} />}

      {!error && <><DataTable columns={localizedColumns} visibleKeys={visibleKeys} rows={rows} loading={loading} density={density} sortBy={sortBy} sortDir={sortDir} hasActiveFilters={hasActiveFilters} selectedIds={selectedIds} allVisibleRowsSelected={allVisibleRowsSelected} onToggleRow={(id) => setSelectedIds((current) => current.includes(id) ? current.filter((selectedId) => selectedId !== id) : [...current, id])} onToggleAll={() => setSelectedIds((current) => allVisibleRowsSelected ? current.filter((id) => !rows.some((row) => row.id === id)) : [...new Set([...current, ...rows.map((row) => row.id)])])} onClearFilters={() => { setSearch(""); setStatus("all"); setPage(1); }} onRefresh={() => setRefreshIndex((value) => value + 1)} onSort={handleSort} onRowClick={setSelectedRow} />

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-panel"><span className="text-slate-500">{response ? <>{t("Mostrando")} <strong className="text-slate-700">{rows.length}</strong> {t("de")} <strong className="text-slate-700">{new Intl.NumberFormat(localeForLanguage[language]).format(response.total)}</strong> {t("registros")}</> : t("Sin datos")}</span><div className="flex items-center gap-3"><label className="flex items-center gap-2 text-xs text-slate-500">{t("Filas")}<select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }} className="rounded border border-slate-200 px-2 py-1.5 text-sm"><option value="35">35</option><option value="50">50</option><option value="100">100</option></select></label><span className="text-xs text-slate-500">{t("Página")} {response?.page ?? 1} {t("de")} {response?.totalPages ?? 1}</span><button type="button" disabled={page <= 1 || loading} onClick={() => setPage((value) => value - 1)} className="grid h-8 w-8 place-items-center rounded border border-slate-200 disabled:opacity-40" aria-label={t("Página anterior")}><ChevronLeft size={16} /></button><button type="button" disabled={!response || page >= response.totalPages || loading} onClick={() => setPage((value) => value + 1)} className="grid h-8 w-8 place-items-center rounded border border-slate-200 disabled:opacity-40" aria-label={t("Página siguiente")}><ChevronRight size={16} /></button></div></div></>}

      {selectedRow && <RowDrawer row={selectedRow} columns={localizedColumns} editable={canEditInstallations} onClose={() => setSelectedRow(null)} onSave={async (row) => {
        const saved = await saveInstallation(session.token, row.id, {
          code: String(row.code ?? ""),
          name: String(row.name ?? ""),
          city: String(row.city ?? ""),
          timezone: String(row.timezone ?? "Europe/Madrid"),
          environment: String(row.environment ?? "Producción"),
          version: String(row.version ?? "0.1.0"),
          status: String(row.status ?? "Activa"),
          manager: String(row.manager ?? ""),
        });
        setEditedRows((current) => ({ ...current, [saved.id]: saved }));
        setSelectedRow(null);
        setRefreshIndex((value) => value + 1);
        setActionMessage(t(row.id === "new" ? "Instalación creada correctamente." : "Cambios guardados correctamente."));
      }} />}
      {showQueryConfiguration && <QueryConfigurationPanel resource={resource} session={session} onReportError={onReportError} onClose={() => setShowQueryConfiguration(false)} onPublished={(nextConfiguration) => {
        setQueryConfiguration(nextConfiguration);
        const configuredKeys = nextConfiguration.columns.filter((column) => column.visible).map((column) => column.key);
        if (configuredKeys.length > 0) setVisibleKeys(configuredKeys);
      }} />}
      {showStockMovement && <StockMovementPanel session={session} initialValues={selectedRow ? { sku: String(selectedRow.sku ?? ""), lot: String(selectedRow.lot ?? "") } : undefined} onClose={() => setShowStockMovement(false)} onSaved={() => { setShowStockMovement(false); setRefreshIndex((value) => value + 1); setActionMessage(t("Movimiento de stock registrado correctamente.")); }} />}
      {showWorkspaceRecord && <WorkspaceRecordPanel resource={resource} session={session} onClose={() => setShowWorkspaceRecord(false)} onSaved={(message) => { setShowWorkspaceRecord(false); setRefreshIndex((value) => value + 1); setActionMessage(message); }} />}
      {showLocationLabelPrint && <LocationLabelPrintPanel rows={rows} onClose={() => setShowLocationLabelPrint(false)} />}
      {showPageActions && <PageActionsConfigurationPanel actions={pageActions} onClose={() => setShowPageActions(false)} onSave={async (actions) => { const saved = await savePageActions(resource, session.token, actions); setPageActions(saved.actions); setActionMessage(t("Acciones guardadas para esta instalación.")); }} />}
    </div>
  );
}

function DataTable({ columns, visibleKeys, rows, loading, density, sortBy, sortDir, hasActiveFilters, selectedIds, allVisibleRowsSelected, onToggleRow, onToggleAll, onClearFilters, onRefresh, onSort, onRowClick }: { columns: TableColumn[]; visibleKeys: string[]; rows: WorkspaceRow[]; loading: boolean; density: "comfortable" | "compact"; sortBy: string; sortDir: "asc" | "desc"; hasActiveFilters: boolean; selectedIds: string[]; allVisibleRowsSelected: boolean; onToggleRow: (id: string) => void; onToggleAll: () => void; onClearFilters: () => void; onRefresh: () => void; onSort: (key: string) => void; onRowClick: (row: WorkspaceRow) => void }) {
  const { t } = useI18n();
  const visibleColumns = columns.filter((column) => visibleKeys.includes(column.key));
  const tableViewportRef = useRef<HTMLDivElement>(null);
  const topScrollbarRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const [tableWidth, setTableWidth] = useState(0);

  useEffect(() => {
    const measureTable = () => setTableWidth(tableRef.current?.scrollWidth ?? 0);
    measureTable();
    window.addEventListener("resize", measureTable);
    return () => window.removeEventListener("resize", measureTable);
  }, [visibleColumns.length, rows.length, density, loading]);

  const syncFromTop = () => {
    if (tableViewportRef.current && topScrollbarRef.current) tableViewportRef.current.scrollLeft = topScrollbarRef.current.scrollLeft;
  };
  const syncFromTable = () => {
    if (tableViewportRef.current && topScrollbarRef.current) topScrollbarRef.current.scrollLeft = tableViewportRef.current.scrollLeft;
  };

  return <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-panel"><div ref={topScrollbarRef} onScroll={syncFromTop} className="table-horizontal-scrollbar overflow-x-scroll overflow-y-hidden border-b border-slate-200 bg-slate-50 px-4 py-1.5" aria-label={t("Desplazar columnas de la tabla")}><div style={{ width: `${Math.max(tableWidth, 1)}px` }} className="h-3" /></div><div ref={tableViewportRef} onScroll={syncFromTable} className="overflow-x-auto"><table ref={tableRef} className="min-w-max w-full text-left text-sm"><thead className="border-b border-slate-200 bg-slate-50"><tr><th className="sticky left-0 z-10 w-12 bg-slate-50 px-3"><input type="checkbox" checked={allVisibleRowsSelected} onChange={onToggleAll} disabled={loading || rows.length === 0} aria-label={t("Seleccionar todos los registros visibles")} /></th>{visibleColumns.map((column, index) => <th key={column.key} className={`whitespace-nowrap px-4 text-[11px] font-bold uppercase tracking-wide text-slate-500 ${density === "compact" ? "py-2.5" : "py-3.5"} ${column.width ?? ""} ${index === 0 ? "sticky left-12 z-10 bg-slate-50" : ""}`}><button type="button" onClick={() => onSort(column.key)} className={`flex items-center gap-1.5 ${column.numeric ? "ml-auto" : ""}`}>{column.label}<ChevronsUpDown size={13} className={sortBy === column.key ? "text-brand" : "text-slate-300"} />{sortBy === column.key && <span className="sr-only">{t(sortDir === "asc" ? "Ordenado ascendente" : "Ordenado descendente")}</span>}</button></th>)}<th className="w-12 px-3" aria-label={t("Acciones")} /></tr></thead><tbody>{loading ? Array.from({ length: 8 }, (_, index) => <tr key={index} className="border-b border-slate-100"><td className="px-3 py-4" /><td colSpan={visibleColumns.length} className="px-4 py-4"><div className="h-3 animate-pulse rounded bg-slate-100" /></td><td /></tr>) : rows.map((row) => { const selected = selectedIds.includes(row.id); return <tr key={row.id} onClick={() => onRowClick(row)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onRowClick(row); } }} tabIndex={0} role="button" aria-label={`${t("Ver detalle de")} ${String(row.reference ?? row.sku ?? row.code ?? row.id)}`} className={`group cursor-pointer border-b border-slate-100 transition hover:bg-blue-50/60 focus-visible:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand ${selected ? "bg-blue-50/50" : ""}`}><td className="sticky left-0 z-[1] bg-white px-3" onClick={(event) => event.stopPropagation()}><input type="checkbox" checked={selected} onChange={() => onToggleRow(row.id)} aria-label={`${t("Seleccionar")} ${String(row.reference ?? row.sku ?? row.code ?? row.id)}`} /></td>{visibleColumns.map((column, index) => { const value = row[column.key]; const presentation = getCellPresentation(value, column); const cellStyle = presentation.background || presentation.textColor ? { backgroundColor: presentation.background, color: presentation.textColor } : undefined; return <td key={column.key} className={`whitespace-nowrap px-4 text-slate-600 ${density === "compact" ? "py-2" : "py-3.5"} ${column.numeric ? "text-right tabular-nums" : ""} ${index === 0 ? "sticky left-12 z-[1] bg-white font-semibold text-slate-800 group-hover:bg-blue-50" : ""}`}>{column.key === "progress" ? <div className="flex items-center gap-2"><div className="h-1.5 w-16 rounded-full bg-slate-100"><div className="h-1.5 rounded-full bg-brand" style={{ width: String(value) }} /></div><span className="text-xs tabular-nums">{presentation.text}</span></div> : presentation.percentageValue !== null ? <div className="flex min-w-24 items-center justify-end gap-2"><span className={`inline-flex min-w-12 justify-center px-2 py-1 text-[11px] font-bold ${presentation.badge ? "rounded-md" : "rounded"}`} style={cellStyle}>{presentation.text}</span><span className="h-1.5 w-12 overflow-hidden rounded-full bg-slate-100"><span className="block h-full rounded-full bg-brand" style={{ width: `${presentation.percentageValue}%`, backgroundColor: presentation.background ?? undefined }} /></span></div> : column.key === "status" || column.key === "priority" || column.key === "environment" || presentation.badge ? <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${presentation.background || presentation.textColor ? "" : statusClass(String(value ?? ""))}`} style={cellStyle}>{t(presentation.text)}</span> : <span style={cellStyle}>{t(presentation.text)}</span>}</td>; })}<td className="px-3"><MoreHorizontal size={17} className="text-slate-300 group-hover:text-brand" /></td></tr>; })}{!loading && rows.length === 0 && <tr><td colSpan={visibleColumns.length + 2} className="px-6 py-12"><EmptyState hasActiveFilters={hasActiveFilters} onClearFilters={onClearFilters} onRefresh={onRefresh} /></td></tr>}</tbody></table></div><div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 px-4 py-2.5 text-xs text-slate-400"><span>{t("Tabla reutilizable · columnas configurables · paginación server-side")}</span><span>{t("Casilla para seleccionar · clic en la fila para abrir detalle")}</span></div></div>;
}

function EmptyState({ hasActiveFilters, onClearFilters, onRefresh }: { hasActiveFilters: boolean; onClearFilters: () => void; onRefresh: () => void }) {
  const { t } = useI18n();
  return <div className="mx-auto flex max-w-md flex-col items-center text-center"><div className="grid h-14 w-14 place-items-center rounded-2xl bg-slate-100 text-slate-400"><Inbox size={25} /></div><h3 className="mt-4 text-base font-bold text-slate-700">{t(hasActiveFilters ? "No hay coincidencias" : "Todavía no hay registros")}</h3><p className="mt-1 text-sm leading-6 text-slate-500">{t(hasActiveFilters ? "No encontramos registros con los filtros actuales. Puedes limpiarlos y volver a mostrar todo el contenido." : "Esta pantalla está preparada para recibir datos. Puedes actualizarla cuando el origen esté disponible.")}</p><div className="mt-5 flex flex-wrap justify-center gap-2">{hasActiveFilters && <button type="button" onClick={onClearFilters} className="flex min-h-10 items-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"><RotateCcw size={16} />{t("Limpiar filtros")}</button>}<button type="button" onClick={onRefresh} className="flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"><RefreshCw size={16} />{t("Actualizar")}</button></div></div>;
}

function RowDrawer({ row, columns, editable, onClose, onSave }: { row: WorkspaceRow; columns: TableColumn[]; editable: boolean; onClose: () => void; onSave: (row: WorkspaceRow) => Promise<void> }) {
  const { t } = useI18n();
  const [draft, setDraft] = useState(row);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const editableKeys = ["code", "name", "city", "timezone", "environment", "version", "status", "manager"];
  const isNew = row.id === "new";
  const handleSave = async () => {
    setSaving(true);
    setSaveError("");
    try {
      await onSave(draft);
      setSaved(true);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "No se pudo guardar la instalación");
    } finally {
      setSaving(false);
    }
  };
  return <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/25" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }}><aside className="flex h-full w-full max-w-[520px] flex-col bg-white shadow-2xl"><div className="flex items-start justify-between border-b border-slate-200 px-6 py-5"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-brand">{t(editable ? "Administración" : "Detalle operativo")}</p><h2 className="mt-1 text-xl font-bold text-ink">{isNew ? t("Nueva instalación") : String(draft.name ?? draft.reference ?? draft.sku ?? t("Registro"))}</h2><p className="mt-1 text-sm text-slate-500">{t(editable ? "Puedes revisar y actualizar los datos de esta instalación." : "Consulta los datos del registro seleccionado.")}</p></div><button type="button" onClick={onClose} disabled={saving} className="grid h-9 w-9 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-40" aria-label={t("Cerrar detalle")}><X size={18} /></button></div><div className="flex-1 overflow-y-auto px-6 py-5"><div className="grid gap-4 sm:grid-cols-2">{columns.map((column) => <label key={column.key} className="block"><span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">{column.label}</span><input disabled={!editable || !editableKeys.includes(column.key)} value={String(draft[column.key] ?? "")} onChange={(event) => setDraft((current) => ({ ...current, [column.key]: event.target.value }))} className={`h-10 w-full rounded-lg border px-3 text-sm outline-none ${editable && editableKeys.includes(column.key) ? "border-slate-300 bg-white focus:border-brand focus:ring-4 focus:ring-blue-100" : "border-slate-200 bg-slate-50 text-slate-500"}`} /></label>)}</div></div>{editable && <div className="border-t border-slate-200 px-6 py-4"><div className="space-y-3"><div className="flex items-center justify-between gap-3"><span className={`text-xs font-semibold ${saved ? "text-emerald-600" : "text-slate-400"}`} role="status">{saved ? t("Cambios guardados") : t("Solo Developer y Product Owner pueden editar")}</span><div className="flex gap-2"><button type="button" onClick={onClose} disabled={saving} className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 disabled:opacity-40">{t("Cancelar")}</button><button type="button" onClick={handleSave} disabled={saving} className="flex items-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60"><Check size={16} />{saving ? t("Guardando…") : t("Guardar cambios")}</button></div></div>{saveError && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700" role="alert">{saveError}</p>}</div></div>}</aside></div>;
}
