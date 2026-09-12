# Pendientes de Almacén SGA

Estado revisado el 12/09/2026. `[~]` indica que queda una evolución de producción, aunque el flujo demo o la primera vertical ya estén operativos.

## Cerrado en esta iteración

- [x] Login demo contra PostgreSQL, logout, sesión asociada a cliente/instalación y permisos por rol.
- [x] Roles `WAREHOUSE_MANAGER`, `DEVELOPER` y `PRODUCT_OWNER` con tabla de permisos y asignaciones en Prisma.
- [x] Almacenamiento de instalaciones, stock, movimientos, auditoría, configuraciones versionadas, acciones de página y registros operativos de los módulos restantes.
- [x] Agregados Prisma tipados para recepción, picking, expedición, ubicaciones, inventario físico, reposición, movimientos, consultas guardadas, artículos, proveedores y clientes, con vistas SQL compatibles, altas, edición y cambios de estado.
- [x] Consultas configurables para Stock y el resto de módulos operativos, con SQL parametrizado, validación de solo lectura, timeout de 5 segundos, límite de 10.000 filas, publicación, versiones y rollback.
- [x] Operaciones funcionales de creación/edición sobre recepción, picking, expedición, ubicaciones, movimientos, inventario, reposición, maestros e integraciones; movimientos y consultas guardadas ya utilizan agregados Prisma tipados.
- [x] SQL Helper, Loop Helper, Updater, Importador XML, ejecución/reintento de integraciones y registro de ejecuciones en `ToolRun` con auditoría.
- [x] Dashboard conectado a métricas reales de PostgreSQL.
- [x] Navegación responsive, hash por pantalla, breadcrumb, acciones rápidas, estados vacíos recuperables, error boundary, teclado y `prefers-reduced-motion`.
- [x] Validación responsive real en navegador a 390×844 y 1440×900; se corrigió el overflow horizontal producido por la tabla densa del dashboard.
- [x] Rate limiting de login compartido en PostgreSQL, request ID y métricas protegidas por permiso (`/api/metrics`).
- [x] Build y lint de API/web, 17 pruebas (12 de API y 5 de adaptadores), smoke E2E HTTP, prueba de concurrencia de stock y prueba de rendimiento: 20 peticiones, 100% correctas, p95 429 ms.
- [x] Login refinado con logo NORTELOG visible en cabecera y tarjeta, indicador de producción con icono semántico, selectores `data-testid` para controles críticos y smoke manual de error de credenciales, acceso válido, navegación y logout.
- [x] Gestión de errores para operarios: mensaje humano, tabla ocultada cuando falla la consulta, reintento, ayuda de soporte, contexto automático protegido, observaciones opcionales y captura.
- [x] Preparación de producción con imagen Docker separada, PostgreSQL persistente, Caddy HTTPS y documentación para entornos aislados y publicados.
- [x] Pipeline de GitHub Actions para instalación limpia, esquema demo, lint, build, pruebas API, smoke HTTP y rendimiento.

## Evolución pendiente

- [~] Sustituir la autenticación demo propia por Better Auth. Requiere planificar la migración de tablas de usuario/sesión y conservar las asignaciones actuales sin pérdida de sesiones ni permisos. La implementación actual queda estable y documentada hasta disponer de la dependencia y una migración verificable.
- [x] Reemplazar progresivamente `WorkspaceRecord`/JSON por agregados Prisma tipados en usuarios, roles, auditoría e integraciones. Los módulos operativos, movimientos, consultas guardadas y maestros principales ya se han migrado; `WorkspaceRecord` queda como compatibilidad para datos legacy.
- [~] Extraer repositorios y casos de uso por módulo para reducir el endpoint de workspace monolítico sin romper las vistas SQL configurables.
- [x] Extraer el repositorio Prisma de lecturas tipadas (`apps/api/src/workspace-repository.ts`) manteniendo el contrato de serialización existente.
- [~] Cambiar la paginación actual basada en la vista de transición por repositorios de dominio con filtros y ordenación tipados por módulo.
- [~] Conectar endpoints y credenciales reales SOAP/REST y colas de segundo plano. Los adaptadores REST/SOAP, timeout, errores y modo externo ya están implementados; el entorno local sigue protegido en `SIMULATED` hasta recibir configuración externa.
- [~] Añadir pruebas E2E de navegador y visual regression en las resoluciones operativas objetivo. Ya existe smoke E2E HTTP reproducible (`npm run test:e2e`) y validación visual manual; queda automatizar el navegador real.
- [~] Añadir observabilidad de producción: métricas de API y rate limiting distribuido ya están implementados; quedan trazas, alertas y backups verificados.
- [~] Separar casos de uso y adaptadores en carpetas de dominio/aplicación/infraestructura a medida que se sustituyan los endpoints monolíticos actuales, manteniendo SOLID sin introducir microservicios prematuramente.
- [~] Publicar el repositorio en GitHub y desplegarlo: falta definir el repositorio destino, autenticar la cuenta y disponer de un servidor/dominio o proveedor de ejecución.

## Verificación actual

```powershell
docker compose up --build -d api web
docker compose exec api npx prisma db push
docker compose exec api npm run prisma:seed
docker compose exec api npm test
npm run lint --workspace=@almacensga/api
npm run build --workspace=@almacensga/api
npm run lint --workspace=@almacensga/web
npm run build --workspace=@almacensga/web
npm run test:perf
npm run test:e2e
```

Credenciales demo: `jgarcia`, `adev` y `powner`, todos con contraseña `demo123`. No se incorpora Resend.
