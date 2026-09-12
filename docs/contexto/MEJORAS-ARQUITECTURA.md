# Mejoras aplicadas y siguiente fase

Este documento resume las mejoras incorporadas en la vertical actual y separa claramente lo que ya funciona de lo que todavía depende de infraestructura de producción.

## Implementado en esta fase

### Almacenamiento de Stock

- `StockItem` almacena existencias por instalación, SKU, lote, ubicación, estado, mínimos, proveedor y última modificación.
- `StockMovement` registra entradas y salidas con motivo, origen, destino y documento de referencia.
- `POST /api/stock/movements` valida rol, SKU, lote, cantidad y disponibilidad.
- La actualización de existencias, el movimiento y su auditoría se realizan en una única transacción Prisma.
- La pantalla Stock ya obtiene sus 3.200 filas desde PostgreSQL, con paginación y filtros server-side.

### Auditoría y permisos

- `AuditEvent` relaciona cliente, instalación, usuario, recurso, acción, entidad, resultado y detalles JSON.
- Se registran guardados, publicaciones y rollback de configuraciones, además de movimientos de stock.
- La tabla Auditoría consume eventos guardados y mantiene un estado demostrativo recuperable cuando una instalación aún no tiene eventos.
- Los permisos se almacenan en `Permission` y `RolePermission`; el backend los valida aunque se invoque manualmente un endpoint.
- Usuarios, roles e integraciones ya se leen desde agregados Prisma tipados sin devolver hashes de contraseña.

### Configuración visual portable y ejecución segura

- Las columnas admiten texto, número, porcentaje, moneda, fecha y estado.
- Se admiten decimales, sufijos, fondo, color de texto, badges y reglas condicionales.
- El contrato JSON incluye `schemaVersion`, SQL, parámetros, columnas, filtros, acciones y roles.
- Las versiones se guardan en `QueryConfigurationVersion` y el rollback genera un borrador nuevo.
- El SQL configurado de Stock y de los módulos operativos se limita a sentencias `SELECT` o `WITH`, exige `:installationId`, usa vistas lógicas, aplica timeout de 5 segundos y limita a 10.000 filas; se rechazan operaciones de escritura/destructivas.

### Herramientas, integraciones y UX

- SQL Helper valida en la interfaz el carácter de solo lectura antes de guardar.
- Loop Helper ejecuta cambios de estado de hasta 100 registros dentro de una transacción y registra el resultado.
- Updater publica versión y entorno de la instalación, con sincronización y auditoría.
- Importador XML valida el documento y crea una recepción guardada.
- Integraciones disponen de modo simulado por defecto y adaptadores REST/SOAP externos con timeout, validación de endpoint, reintentos y `ToolRun`.
- La tabla común tiene búsqueda, filtros, ordenación, paginación, selector de columnas, exportación, densidad, barra horizontal superior sincronizada, detalle lateral y estados vacíos recuperables.
- Se mantiene el dominio DNS local: [http://almacensga.es](http://almacensga.es).

## Decisiones de seguridad

- La interfaz no es una frontera de seguridad: el API comprueba sesión y rol.
- El límite de intentos de login se guarda en PostgreSQL, de forma que varias réplicas comparten el mismo bucket; el límite y la ventana se configuran con `LOGIN_RATE_LIMIT_MAX` y `LOGIN_RATE_LIMIT_WINDOW_MS`.
- No se ejecuta SQL arbitrario: las consultas se validan por recurso, solo admiten lectura y se ejecutan con parámetros y límites.
- El seed es idempotente para el stock demo y ya no borra masivamente todas las existencias antes de recrearlas.
- Antes de producción deben añadirse lista blanca de tablas/campos, parámetros tipados, límite de filas, timeout, cancelación y registro de duración.
- Los backups de Docker/PostgreSQL deben probarse restaurando en otro entorno; el volumen local no es un backup suficiente.

## Pendiente real

1. Migrar el flujo de autenticación propio a `better-auth`, manteniendo contexto fijo de cliente/instalación y pruebas de sesión.
2. Continuar la extracción de casos de uso y escrituras por módulo; las lecturas tipadas ya están detrás de `workspace-repository.ts`.
3. Conectar endpoints y credenciales reales SOAP/REST y colas de segundo plano del entorno objetivo.
4. Añadir automatización de navegador/visual regression, restauración verificada de backups, trazas y alertas; ya existe smoke E2E HTTP, métricas de API y rate limiting compartido.
5. Completar la gestión avanzada de asignaciones usuario–instalación–rol desde el panel administrativo.

La alta y edición de usuarios ya permite asignar instalación y rol, y la alta/edición de roles permite gestionar claves de permisos; quedan como refinamientos futuros la gestión masiva y la revocación selectiva de asignaciones.

## Comandos de verificación

```powershell
docker compose up --build -d
docker compose exec api npx prisma db push
docker compose exec api npm run prisma:seed
docker compose exec api npm run lint
docker compose exec web npm run build
docker compose exec api npm test
```

La URL funcional de la prueba es [http://almacensga.es](http://almacensga.es).
