import type { PageAction, WorkspaceResource } from "./workspace";

const operationRoles = ["WAREHOUSE_MANAGER", "DEVELOPER", "PRODUCT_OWNER"];
const adminRoles = ["DEVELOPER", "PRODUCT_OWNER"];

export const DEFAULT_PAGE_ACTIONS: Record<WorkspaceResource, PageAction[]> = {
  stock: [
    { id: "new-stock-movement", label: "Nuevo movimiento", kind: "defined", actionType: "operation", enabled: true, variant: "primary", roleKeys: operationRoles },
    { id: "adjust-stock", label: "Ajustar stock", kind: "defined", actionType: "operation", enabled: true, variant: "secondary", roleKeys: operationRoles },
    { id: "view-stock-movements", label: "Ver movimientos", kind: "defined", actionType: "navigation", enabled: true, variant: "secondary", targetResource: "movements" },
    { id: "export-stock", label: "Exportar", kind: "defined", actionType: "export", enabled: true, variant: "secondary" },
  ],
  receipts: [
    { id: "new-receipt", label: "Nueva recepción", kind: "defined", actionType: "operation", enabled: true, variant: "primary", roleKeys: operationRoles },
    { id: "validate-receipt", label: "Validar recepción", kind: "defined", actionType: "operation", enabled: true, variant: "secondary", roleKeys: operationRoles },
    { id: "export-receipts", label: "Exportar", kind: "defined", actionType: "export", enabled: true, variant: "secondary" },
  ],
  picking: [
    { id: "new-picking-wave", label: "Crear ola", kind: "defined", actionType: "operation", enabled: true, variant: "primary", roleKeys: operationRoles },
    { id: "assign-picker", label: "Asignar operario", kind: "defined", actionType: "operation", enabled: true, variant: "secondary", roleKeys: operationRoles },
    { id: "start-picking", label: "Iniciar preparación", kind: "defined", actionType: "operation", enabled: true, variant: "secondary", roleKeys: operationRoles },
    { id: "export-picking", label: "Exportar", kind: "defined", actionType: "export", enabled: true, variant: "secondary" },
  ],
  shipments: [
    { id: "new-shipment", label: "Nueva expedición", kind: "defined", actionType: "operation", enabled: true, variant: "primary", roleKeys: operationRoles },
    { id: "confirm-load", label: "Confirmar carga", kind: "defined", actionType: "operation", enabled: true, variant: "secondary", roleKeys: operationRoles },
    { id: "print-shipping-label", label: "Imprimir etiquetas", kind: "defined", actionType: "operation", enabled: true, variant: "secondary", roleKeys: operationRoles },
    { id: "export-shipments", label: "Exportar", kind: "defined", actionType: "export", enabled: true, variant: "secondary" },
  ],
  installations: [
    { id: "new-installation", label: "Nueva instalación", kind: "defined", actionType: "operation", enabled: true, variant: "primary", roleKeys: adminRoles },
    { id: "sync-installations", label: "Sincronizar", kind: "defined", actionType: "operation", enabled: true, variant: "secondary", roleKeys: adminRoles },
    { id: "export-installations", label: "Exportar", kind: "defined", actionType: "export", enabled: true, variant: "secondary", roleKeys: adminRoles },
  ],
  locations: [
    { id: "new-location", label: "Nueva ubicación", kind: "defined", actionType: "operation", enabled: true, variant: "primary", roleKeys: operationRoles },
    { id: "import-layout", label: "Importar mapa", kind: "defined", actionType: "operation", enabled: true, variant: "secondary", roleKeys: adminRoles },
    { id: "print-location-labels", label: "Imprimir etiquetas", kind: "defined", actionType: "operation", enabled: true, variant: "secondary", roleKeys: operationRoles },
    { id: "export-locations", label: "Exportar", kind: "defined", actionType: "export", enabled: true, variant: "secondary" },
  ],
  movements: [
    { id: "new-movement", label: "Nuevo movimiento", kind: "defined", actionType: "operation", enabled: true, variant: "primary", roleKeys: operationRoles },
    { id: "confirm-movement", label: "Confirmar seleccionados", kind: "defined", actionType: "operation", enabled: true, variant: "secondary", roleKeys: operationRoles },
    { id: "export-movements", label: "Exportar", kind: "defined", actionType: "export", enabled: true, variant: "secondary" },
  ],
  inventory: [
    { id: "new-inventory-count", label: "Nuevo conteo", kind: "defined", actionType: "operation", enabled: true, variant: "primary", roleKeys: operationRoles },
    { id: "approve-differences", label: "Aprobar diferencias", kind: "defined", actionType: "operation", enabled: true, variant: "secondary", roleKeys: operationRoles },
    { id: "export-inventory", label: "Exportar", kind: "defined", actionType: "export", enabled: true, variant: "secondary" },
  ],
  queries: [
    { id: "new-query", label: "Nueva consulta", kind: "defined", actionType: "operation", enabled: true, variant: "primary", roleKeys: adminRoles },
    { id: "test-query", label: "Probar consulta", kind: "defined", actionType: "operation", enabled: true, variant: "secondary", roleKeys: adminRoles },
    { id: "export-queries", label: "Exportar", kind: "defined", actionType: "export", enabled: true, variant: "secondary" },
  ],
  users: [
    { id: "new-user", label: "Nuevo usuario", kind: "defined", actionType: "operation", enabled: true, variant: "primary", roleKeys: adminRoles },
    { id: "expire-sessions", label: "Cerrar sesiones", kind: "defined", actionType: "operation", enabled: true, variant: "secondary", roleKeys: adminRoles },
    { id: "export-users", label: "Exportar", kind: "defined", actionType: "export", enabled: true, variant: "secondary", roleKeys: adminRoles },
  ],
  products: [
    { id: "new-product", label: "Nuevo artículo", kind: "defined", actionType: "operation", enabled: true, variant: "primary", roleKeys: adminRoles },
    { id: "import-products", label: "Importar artículos", kind: "defined", actionType: "operation", enabled: true, variant: "secondary", roleKeys: adminRoles },
    { id: "export-products", label: "Exportar", kind: "defined", actionType: "export", enabled: true, variant: "secondary" },
  ],
  replenishment: [
    { id: "generate-replenishment", label: "Generar reposición", kind: "defined", actionType: "operation", enabled: true, variant: "primary", roleKeys: operationRoles },
    { id: "assign-replenishment", label: "Asignar tarea", kind: "defined", actionType: "operation", enabled: true, variant: "secondary", roleKeys: operationRoles },
    { id: "export-replenishment", label: "Exportar", kind: "defined", actionType: "export", enabled: true, variant: "secondary" },
  ],
  suppliers: [
    { id: "new-supplier", label: "Nuevo proveedor", kind: "defined", actionType: "operation", enabled: true, variant: "primary", roleKeys: adminRoles },
    { id: "export-suppliers", label: "Exportar", kind: "defined", actionType: "export", enabled: true, variant: "secondary" },
  ],
  customers: [
    { id: "new-customer", label: "Nuevo cliente", kind: "defined", actionType: "operation", enabled: true, variant: "primary", roleKeys: adminRoles },
    { id: "export-customers", label: "Exportar", kind: "defined", actionType: "export", enabled: true, variant: "secondary" },
  ],
  integrations: [
    { id: "run-integration", label: "Ejecutar sincronización", kind: "defined", actionType: "operation", enabled: true, variant: "primary", roleKeys: adminRoles },
    { id: "retry-integration", label: "Reintentar fallidos", kind: "defined", actionType: "operation", enabled: true, variant: "secondary", roleKeys: adminRoles },
    { id: "export-integrations", label: "Exportar", kind: "defined", actionType: "export", enabled: true, variant: "secondary", roleKeys: adminRoles },
  ],
  audit: [
    { id: "export-audit", label: "Exportar auditoría", kind: "defined", actionType: "export", enabled: true, variant: "primary", roleKeys: ["WAREHOUSE_MANAGER", ...adminRoles] },
    { id: "download-audit-log", label: "Descargar log", kind: "defined", actionType: "export", enabled: true, variant: "secondary", roleKeys: adminRoles },
  ],
  roles: [
    { id: "new-role", label: "Nuevo rol", kind: "defined", actionType: "operation", enabled: true, variant: "primary", roleKeys: adminRoles },
    { id: "export-roles", label: "Exportar", kind: "defined", actionType: "export", enabled: true, variant: "secondary", roleKeys: adminRoles },
  ],
};

export const getDefaultPageActions = (resource: WorkspaceResource) => DEFAULT_PAGE_ACTIONS[resource].map((action) => ({ ...action, roleKeys: action.roleKeys ? [...action.roleKeys] : undefined }));
