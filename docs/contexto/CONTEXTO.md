# Contexto del proyecto — Almacén SGA

Este documento es la fuente de contexto funcional y técnico del proyecto. Debe consultarse antes de continuar el desarrollo en una nueva sesión.

## 1. Objetivo

Migrar progresivamente una aplicación de escritorio WinForms de gestión de almacenes hacia una plataforma web moderna, dinámica y configurable.

La aplicación original, denominada Almacén SGA, se caracteriza por:

- Módulos y portales configurables.
- Consultas SQL que muestran resultados tabulares.
- Acciones superiores para ejecutar operaciones.
- Integraciones existentes mediante servicios Java SOAP.
- Migración progresiva de servicios hacia middleware C# con API REST.
- Uso por gestores o jefes de almacén desde la aplicación principal.
- Uso por operarios desde una aplicación Android/Kotlin para movimientos e inventarios.

No se desarrollará landing page.

## 2. Stack previsto

- Arquitectura: monorepo.
- Frontend: React, Vite y Tailwind CSS.
- Backend: Express.
- Base de datos: PostgreSQL.
- ORM: Prisma.
- Autenticación: sesión propia vinculada a PostgreSQL, con permisos por rol y limitación básica de intentos; migración a better-auth pendiente como evolución controlada.
- Correos: descartados por ahora; no se incorporará Resend.
- Contenedores: Docker y Docker Compose.
- Control de versiones: Git y GitHub.
- Producción prevista: Azure.

## 3. Arquitectura acordada

Se comenzará con un monolito modular, separado internamente por módulos y capas, preparado para crecer sin introducir microservicios prematuramente.

```text
React + Vite
    ↓
Express API REST
    ↓
Casos de uso de aplicación
    ↓
Módulos de dominio SGA
    ↓
Puertos y adaptadores
    ├── PostgreSQL + Prisma
    ├── Servicios SOAP existentes
    ├── Middleware y APIs REST
    └── Procesos en segundo plano
```

Se deben aplicar SOLID, Clean Code y separación clara entre dominio, aplicación, infraestructura y presentación.

## 4. Módulos funcionales previstos

- Autenticación, sesiones, usuarios, roles y permisos.
- Clientes, instalaciones y almacenes.
- Maestros de artículos, proveedores y clientes.
- Dashboard y preferencias del usuario.
- Recepciones y entradas.
- Ubicaciones y movimientos.
- Stock e inventario físico.
- Reposición y trazabilidad.
- Reposición con tareas sugeridas, origen/destino y prioridad.
- Picking, preparación y expediciones.
- Consultas configurables.
- Configuración por instalación de consultas y módulos: SQL parametrizado, columnas visibles, filtros, ordenación, etiquetas, acciones y permisos.
- SQL Helper y otras herramientas internas.
- Integraciones SOAP y REST.
- Auditoría y registro de operaciones.
- Integraciones, roles y permisos con tablas operativas detalladas.
- Configuración de menús, logos y personalización.

### Roles iniciales

- `WAREHOUSE_MANAGER` / Gestor de almacén: puede consultar stock, recepciones, picking, expediciones y ejecutar operaciones de almacén. No puede administrar instalaciones.
- `DEVELOPER`: puede acceder a las operaciones y administrar instalaciones y configuración técnica.
- `PRODUCT_OWNER`: puede acceder a las operaciones y administrar instalaciones y configuración funcional.

La restricción se aplica en frontend para ocultar la navegación y en backend con `403`, no solo visualmente. En la demo, `installations`, `users`, `roles` e `integrations` requieren Developer o Product Owner.

## 5. Cliente, instalación y sesión

El usuario no debe poder cambiar cliente ni instalación desde el dashboard.

La sesión se inicia ya asociada a un contexto concreto y puede contener internamente:

```text
userId
clientId
installationId
warehouseId
roleId
permissions
```

Cliente e instalación se mostrarán como información contextual de solo lectura. Si en el futuro se permite cambiar de instalación, deberá ser un flujo independiente, probablemente previo al login o al cerrar la sesión.

## 6. Diseño de interfaz

Dirección visual aprobada:

- Aplicación empresarial B2B orientada a operaciones de almacén.
- Dashboard denso pero legible.
- Panel lateral fijo.
- Cabecera con búsqueda, notificaciones, usuario y breadcrumb.
- Fondo claro y limpio.
- Sidebar azul marino.
- Acciones principales azules.
- Indicadores positivos en teal/verde y pendientes en ámbar.
- Componentes con bordes suaves, sombras discretas y jerarquía clara.
- Iconos SVG, sin emojis en la interfaz final.
- Accesibilidad, contraste suficiente, navegación por teclado y estados de carga visibles.
- Estados vacíos comunes en todas las tablas: mensaje explicativo, icono, limpiar filtros y actualizar sin reiniciar la aplicación.
- Frontera de errores del panel: si un módulo falla al renderizar, se muestra una pantalla de recuperación con reintento y recarga controlada, nunca un lienzo blanco.
- Tablas maestras y operativas con muchas columnas, scroll horizontal controlado, selector de columnas, ordenación y detalle lateral común.
- Las tablas densas incluyen una barra de desplazamiento horizontal sincronizada en la parte superior, con la primera columna fijada para evitar tener que bajar al final de la tabla.
- Cada módulo tiene una sección superior de acciones. Parte de botones definidos por módulo, permite activarlos/desactivarlos y permite añadir acciones custom por instalación. La configuración se guarda en PostgreSQL y solo Developer/Product Owner puede modificarla.

### Configuración administrativa de consultas por instalación

La administración no debe limitarse a gestionar usuarios o instalaciones. Un Developer o Product Owner podrá abrir la configuración de una consulta concreta —por ejemplo, la consulta de Stock— y definir qué necesita visualizar cada instalación:

- SQL o consulta parametrizada asociada al módulo.
- Columnas visibles, orden, etiquetas, formatos y columnas calculadas.
- Filtros disponibles y valores iniciales.
- Ordenación por defecto y paginación.
- Acciones superiores habilitadas.
- Permisos por rol y alcance de datos.
- Versión, borrador, publicación, rollback y auditoría de cambios.

La instalación consumirá la configuración publicada que le corresponda, sin modificar directamente el código de la aplicación.

### Login

El login debe incluir:

- Marca Almacén SGA en la cabecera.
- Logo del cliente dentro de la tarjeta, no dos logos principales iguales.
- Usuario.
- Contraseña.
- Instalación como contexto secundario, no como campo equivalente.
- Entorno y versión.

No debe incluir:

- Campo de cliente.
- Recordar sesión.
- Recuperación de contraseña.
- Error de login en el estado inicial.
- Cambio de cliente o instalación desde el dashboard.

### Dashboard

El dashboard inicial debe contemplar:

- Panel lateral con Inicio, Operaciones, Inventario, Consultas, Administración y Herramientas.
- KPIs de stock, entradas pendientes, picking y expediciones.
- Actividad del almacén.
- Estado de operaciones.
- Actividad reciente con estados.
- Accesos rápidos.
- Instalación activa como contexto de solo lectura.

## 7. Desarrollo local

La prueba actual utiliza estos servicios Docker:

```text
api       → Express, puerto 3000
web       → React/Vite, puerto 5173
postgres  → PostgreSQL, puerto 5432
proxy     → Caddy, puerto 80
```

El acceso previsto es:

```text
http://almacensga.es
http://api.almacensga.es/api/health
```

El dominio es local del PC mediante el archivo de Windows:

```text
C:\Windows\System32\drivers\etc\hosts
```

Entradas necesarias:

```text
127.0.0.1 almacensga.es
127.0.0.1 api.almacensga.es
```

El script para configurarlo es:

```powershell
.\scripts\setup-hosts.ps1
```

Debe ejecutarse desde PowerShell como administrador.

## 7.1 Pantallas demo disponibles

Además del dashboard, la prueba incluye las siguientes tablas preparadas para datos masivos:

```text
Operaciones: Recepciones, Movimientos, Picking, Expediciones, Reposición
Inventario: Stock, Inventario físico, Ubicaciones, Maestro de artículos
Maestros: Proveedores, Clientes
Sistema: Consultas, Auditoría
Administración: Instalaciones, Usuarios y roles, Roles y permisos, Integraciones
```

La prueba contiene aproximadamente 3.200 existencias guardadas de stock, 1.400 eventos de auditoría demo de fallback, 620 artículos, 460 reposiciones, 240 expediciones, 180 clientes, 86 proveedores y el resto de módulos con volúmenes representativos. Los eventos nuevos de movimientos y configuración se guardan en PostgreSQL.

## 8. Docker y datos

La base de datos no debe vivir dentro del mismo contenedor que la API.

En local:

- PostgreSQL usa el volumen `postgres_data`.
- Docker Compose levanta todos los servicios.
- El proxy enruta frontend y API según el dominio.

En producción se recomienda:

- Frontend y API en contenedores separados.
- PostgreSQL administrado en Azure Database for PostgreSQL Flexible Server.
- Azure Container Registry para imágenes.
- Azure Monitor y Log Analytics para logs.
- Secretos fuera de las imágenes y del repositorio.

Docker facilita la reproducibilidad, pero los backups deben ser externos y verificarse mediante restauraciones reales.

## 9. Consultas dinámicas

Las consultas grandes deben contemplar:

- Paginación obligatoria.
- Límites máximos de resultados.
- Parámetros tipados.
- Tiempo máximo de ejecución.
- Estados de carga, completado, error y resultado parcial.
- Auditoría de usuario, cliente e instalación.
- Permisos específicos para consultas avanzadas.
- Ejecución asíncrona cuando sea necesario.
- Datos de prueba masivos y representativos.

Los XML existentes podrán mantenerse como formato de compatibilidad o importación. La configuración nueva debería almacenarse preferentemente como JSON estructurado en PostgreSQL.

## 10. Estado actual

Ya existe una prueba mínima funcional con:

- Monorepo inicial.
- Frontend React/Vite/Tailwind.
- API Express.
- Prisma conectado a PostgreSQL.
- Endpoint `/api/health`.
- Endpoint de prueba `/api/dashboard`.
- Dashboard visual inicial.
- Docker Compose.
- Caddy como reverse proxy.
- Dominios locales configurados.
- Git inicializado.

También se ha iniciado el primer bloque de implementación:

- Pantalla de login integrada en React/Vite.
- Login de prueba con usuario `jgarcia` y contraseña `demo123`.
- Sesión de prueba almacenada en `sessionStorage`.
- Endpoints Express de login, sesión actual y logout.
- Modelo Prisma para cliente, instalación, almacén, usuario, rol, asignación y sesión.
- Seed demo preparado.

También se ha preparado la primera vertical operativa:

- Tabla reutilizable con columnas configurables, búsqueda, filtro por estado, ordenación, paginación server-side, exportación CSV, densidad compacta/cómoda y panel de detalle.
- Pantallas conectadas para Stock, Recepciones, Movimientos, Ubicaciones, Picking, Expediciones, Inventario físico, Consultas guardadas, Usuarios/Roles e Instalaciones.
- Dataset demo generado para comprobar rendimiento: 3.200 registros de stock, 360 recepciones, 280 tareas de picking, 240 expediciones y 24 instalaciones.
- Datasets adicionales: 1.200 movimientos, 520 ubicaciones, 420 conteos de inventario, 36 consultas guardadas y 48 usuarios.
- Gestión visual de instalaciones con edición cómoda en panel lateral para Developer/Product Owner.
- Endpoints protegidos `/api/workspace/:resource` con paginación, búsqueda, filtros de estado y ordenación.
- Panel de Herramientas con SQL Helper, Loop Helper, Updater e Importador XML en primer flujo funcional seguro; el monitor de integraciones y auditoría enlazan con sus módulos operativos.
- Modelo Prisma para `StockItem`, `StockMovement`, `AuditEvent`, `WorkspaceRecord`, `ToolRun`, `Permission` y `RolePermission`. Stock ya se lee desde PostgreSQL y el gerente puede registrar entradas/salidas con auditoría transaccional.
- Recepción, picking, expedición, ubicaciones, inventario físico, reposición, movimientos, consultas guardadas, artículos, proveedores, clientes, usuarios, roles e integraciones ya utilizan agregados Prisma tipados y vistas SQL compatibles con las consultas configurables. `WorkspaceRecord` queda como compatibilidad para datos legacy; Auditoría se lee desde `AuditEvent`.
- Los permisos se cargan junto con la sesión y se validan en backend para herramientas, configuración, integraciones, usuarios y roles; el frontend solo refleja esa autorización.
- Configuración de Stock por instalación con editor visual, tipos de campo, colores condicionales, JSON portable, historial, rollback y validación de SQL de solo lectura.
- Configuración de acciones de página por instalación mediante `PageActionConfiguration`, con acciones definidas/custom, estado activo, variante visual, roles y auditoría.
- La consulta publicada de Stock se ejecuta realmente sobre la vista lógica PostgreSQL `stock`; sus filas y columnas devueltas alimentan la tabla, con `:installationId`, timeout de 5 segundos y límite de 10.000 filas.

La aplicación web y el esquema compilan correctamente. El flujo de autenticación demo está implementado, el esquema se ha aplicado a PostgreSQL, el seed idempotente se ha ejecutado y la comprobación end-to-end mediante Caddy ha sido completada correctamente. La ruta funcional recomendada es [http://almacensga.es](http://almacensga.es).

El error `502 Bad Gateway` observado anteriormente en `/api/auth/login` fue causado por una API arrancada desde una imagen Docker antigua que no contenía `bcryptjs`; Caddy no podía conectar con el proceso API cuando este se detenía al iniciar. La corrección quedó incorporada en `apps/api/package.json` y requiere reconstruir la imagen con `docker compose up --build -d api`.

Validaciones realizadas:

- `npm run lint --workspace=@almacensga/api`: correcto.
- `npm run build --workspace=@almacensga/api`: correcto.
- `npm run lint --workspace=@almacensga/web`: correcto.
- `npm run build --workspace=@almacensga/web`: correcto.
- `npm test --workspace=@almacensga/api` dentro del contenedor: 17 pruebas pasadas (12 de API y 5 de adaptadores), incluyendo permisos, operaciones registradas, rate limiting compartido, métricas, herramientas, agregados tipados y concurrencia de stock.
- `npm run test:e2e`: smoke E2E HTTP correcto atravesando web, login, sesión, dashboard, ocho módulos, métricas y logout.
- `npm run test:perf`: 20 peticiones concurrentes correctas, p95 de 429 ms.
- Validación visual responsive en navegador: 390×844 y 1440×900 sin overflow horizontal global; las tablas mantienen su scroll interno.
- `GET http://almacensga.es/api/health`: `200`, API y PostgreSQL conectados.
- `POST http://almacensga.es/api/auth/login` con `jgarcia / demo123`: `200`, sesión creada para `NORTELOG / MADRID01`.
- Flujo `me → dashboard → logout`: probado desde la suite de integración.
- Credenciales incorrectas: `401` sin crear sesión.
- Favicon SVG creado en `apps/web/public/favicon.svg` y referenciado desde `apps/web/index.html`.

El dashboard actual es una prueba visual y funcional. Stock ya usa datos guardados en PostgreSQL; las tablas de recepción, picking, expedición y varios maestros siguen conectadas a datos generados hasta completar su modelo de negocio.

## 11. Incidencia 502 resuelta

El 502 de `/api/auth/login` tenía dos causas de despliegue local:

1. La imagen de `api` no se había reconstruido después de añadir `bcryptjs`, por lo que el proceso se detenía al arrancar.
2. Compose montaba volúmenes anónimos sobre `node_modules`, ocultando las dependencias instaladas dentro de la imagen.

La solución aplicada fue reconstruir la imagen, retirar esos montajes anónimos y añadir un healthcheck de API. El proxy Caddy ahora espera a que `api` esté saludable antes de iniciar su dependencia.

## 12. Decisiones pendientes

Consultar [PENDIENTES.md](./PENDIENTES.md) y el inventario funcional completo en [INVENTARIO-FUNCIONAL.md](./INVENTARIO-FUNCIONAL.md).
