# Acciones configurables por página

Cada pantalla operativa muestra una sección `Acciones de la página` situada encima de los filtros y la tabla. La sección es común para Stock, Recepciones, Picking, Expediciones, Instalaciones, Ubicaciones, Movimientos, Inventario, Consultas, Usuarios, Artículos, Reposición, Proveedores, Clientes, Integraciones, Auditoría y Roles.

## Acciones definidas

Cada recurso empieza con un conjunto de acciones propias. Algunos ejemplos:

- Stock: Nuevo movimiento, Ajustar stock, Ver movimientos y Exportar.
- Picking: Crear ola, Asignar operario, Iniciar preparación y Exportar.
- Expediciones: Nueva expedición, Confirmar carga, Imprimir etiquetas y Exportar.
- Instalaciones: Nueva instalación, Sincronizar y Exportar.

Las acciones definidas no se pueden borrar desde el editor, pero sí se pueden desactivar. Así una instalación puede ocultar, por ejemplo, `Imprimir etiquetas` aunque forme parte del catálogo base.

## Acciones custom

Un Developer o Product Owner puede pulsar `Configurar acciones` y después `Añadir acción custom`. Para cada botón se puede configurar:

- Texto visible.
- Activada o desactivada.
- Estilo principal, secundario o peligro.
- Roles autorizados.
- Comportamiento custom.

La acción custom se guarda aunque su caso de uso todavía no esté conectado. Al pulsarla, la interfaz informa de que está preparada; no se ejecuta código arbitrario ni SQL desde el navegador.

## Almacenamiento y API

La configuración se almacena en `PageActionConfiguration`, asociada a `installationId` y `resource`.

```text
GET /api/page-actions/stock
PUT /api/page-actions/stock
```

El `PUT` requiere `Developer` o `Product Owner`. El gerente puede consultar las acciones y utilizarlas, pero no modificarlas. Cada guardado crea un `AuditEvent` con la acción `SAVE_PAGE_ACTIONS`.

Ejemplo de contrato:

```json
{
  "actions": [
    {
      "id": "new-stock-movement",
      "label": "Nuevo movimiento",
      "kind": "defined",
      "actionType": "operation",
      "enabled": false,
      "variant": "primary",
      "roleKeys": ["WAREHOUSE_MANAGER", "DEVELOPER", "PRODUCT_OWNER"]
    },
    {
      "id": "custom-cycle-count",
      "label": "Lanzar conteo cíclico",
      "kind": "custom",
      "actionType": "custom",
      "enabled": true,
      "variant": "secondary",
      "roleKeys": ["WAREHOUSE_MANAGER", "DEVELOPER"]
    }
  ]
}
```

## Conexión con casos de uso

La barra ya conecta exportación, navegación entre módulos, nuevo movimiento de stock y nueva instalación. El resto de botones tienen feedback de preparación hasta que exista su caso de uso completo —recepciones, picking, expediciones, etc.—. Esto evita presentar como funcional una acción que todavía no tiene transacción de negocio detrás.
