# Inventario funcional — Almacén SGA

Recordatorio de las pantallas, módulos y capacidades disponibles en la demo actual.

## Pantallas

| Área | Pantallas |
|---|---|
| Acceso | Login, sesión actual y logout |
| Inicio | Dashboard con KPIs de stock, recepciones pendientes, picking y expediciones; actividad, estado y accesos rápidos |
| Operaciones | Recepciones, Movimientos, Picking, Expediciones y Reposición |
| Inventario | Stock, Inventario físico, Ubicaciones y Maestro de artículos |
| Maestros | Proveedores y Clientes |
| Sistema | Consultas y Auditoría |
| Administración | Instalaciones, Usuarios y roles, Roles y permisos, Integraciones |
| Herramientas | SQL Helper, Loop Helper, Updater e Importador XML |

Todas las pantallas operativas comparten tabla densa, búsqueda, filtros, ordenación, paginación, exportación CSV, selector de columnas, densidad, detalle lateral, estados vacíos y recuperación de errores.

## Funcionalidades transversales

- Contexto de cliente e instalación de solo lectura dentro de la sesión.
- Navegación por hash e historial del navegador, breadcrumb y accesos rápidos.
- Menú lateral responsive con overlay accesible y scrollbar personalizada.
- Filas de tabla utilizables con teclado y respeto de `prefers-reduced-motion`.
- Notificaciones de éxito/error, estados de carga y acciones recuperables.
- Acciones definidas y custom por instalación, configurables por Developer/Product Owner.
- Configuración de consultas por instalación: SQL parametrizado, columnas, etiquetas, tipos, filtros, orden, acciones, roles, borrador, publicación, versiones, rollback y auditoría.
- Exportación CSV de las tablas visibles.
- Auditoría de cambios de instalación, stock, movimientos, configuración, registros operativos y herramientas.

## Operaciones y almacenamiento

- Stock: existencias guardadas en `StockItem`, entradas/salidas transaccionales, validación de cantidades, disponibilidad y auditoría.
- Movimientos: histórico guardado con usuario, tipo, cantidad, motivo, origen/destino y documento.
- Instalaciones: alta/edición, estado, versión, entorno, manager, sincronización y auditoría.
- Recepciones, picking, expediciones, ubicaciones, inventario, reposición, movimientos, consultas guardadas, artículos, proveedores y clientes: agregados Prisma tipados, vistas SQL compatibles, operaciones CRUD básicas, cambios de estado y auditoría.
- Usuarios, roles, integraciones y parte de la auditoría: registros guardados en `WorkspaceRecord` como capa de transición compatible con las tablas configurables.
- Dashboard: métricas calculadas desde PostgreSQL, no desde valores fijos de frontend.

## Herramientas

- SQL Helper: consultas `SELECT` parametrizadas por instalación, solo lectura, recurso permitido, timeout de 5 segundos, límite de 10.000 filas y registro de ejecución.
- Loop Helper: cambio de estado de hasta 100 registros en una operación transaccional.
- Updater: publicación de versión y entorno de la instalación, con fecha de sincronización y auditoría.
- Importador XML: validación de tamaño, entidad/doctype, recepción, líneas, SKU y cantidades; crea una recepción guardada.
- Integraciones: entidad Prisma, ejecución/reintento registrados, actualización de contadores y auditoría. `INTEGRATION_EXECUTION_MODE=SIMULATED` evita llamadas externas por defecto; `EXTERNAL` activa los adaptadores REST/SOAP con timeout y validación de endpoint.
- Runs: histórico de ejecuciones de herramientas (`ToolRun`) y errores.
- Observabilidad API: `X-Request-ID`, métricas de conteo/errores/latencia/memoria/uptime en `/api/metrics`, protegidas por permiso de auditoría.
- Seguridad de acceso: límite de intentos de login guardado en PostgreSQL, configurable por entorno y compartido entre réplicas.

## Roles y permisos

| Rol | Capacidades |
|---|---|
| Gestor de almacén | Consultar y operar módulos de almacén, ejecutar Loop Helper e importar XML; no administra instalaciones, usuarios, roles, integraciones ni SQL |
| Developer | Todas las operaciones, configuración, usuarios/roles, integraciones, SQL, Loop Helper, Updater e XML |
| Product Owner | Mismas capacidades administrativas y de herramientas que Developer |

Los permisos se almacenan en `Permission` y `RolePermission`; el backend devuelve `403` aunque una acción se intente invocar manualmente desde el navegador.

## Endpoints principales

- `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/logout`
- `GET /api/dashboard`
- `GET /api/workspace/:resource`, `POST /api/workspace/:resource`, `PATCH /api/workspace/:resource/:id`
- `POST /api/stock/:id/movements`
- `GET/PUT /api/query-configurations/:resource`
- `GET /api/query-configurations/:resource/versions`
- `POST /api/query-configurations/:resource/versions/:version/rollback`
- `POST /api/query-configurations/:resource/publish`
- `GET/PUT /api/page-actions/:resource`
- `POST /api/tools/sql/execute`, `POST /api/tools/loop/execute`, `POST /api/tools/updater/publish`, `POST /api/tools/xml/import`
- `GET /api/tools/runs`
- `POST /api/integrations/:id/run`, `POST /api/integrations/retry`
- `GET /api/health`

## Límites conocidos

La autenticación propia actual es estable para la demo y usa sesiones vinculadas a PostgreSQL, permisos por rol y limitación básica de intentos. La migración a Better Auth queda como evolución separada. Los módulos operativos, movimientos, consultas guardadas, usuarios, roles, maestros e integraciones ya usan agregados Prisma tipados; `WorkspaceRecord` queda como compatibilidad para datos legacy. Los conectores SOAP/REST reales, colas, observabilidad de producción y pruebas E2E automatizadas todavía requieren infraestructura y credenciales del entorno objetivo.
