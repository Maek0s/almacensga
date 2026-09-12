# Verificación rápida de controles y pantallas

Esta guía acompaña a las pruebas automáticas y sirve para revisar rápidamente que la interfaz responde de forma visible y usable.

## Pruebas automáticas disponibles

Desde la raíz del proyecto:

```bash
npm run lint
npm run build
docker compose exec -T api npm test
npm run test:e2e
npm run test:perf
```

- `npm test` en la API cubre autenticación, permisos, rate limit, métricas, herramientas, concurrencia de stock, operaciones registradas y administración.
- `test:e2e` comprueba el servidor web, login, sesión, dashboard, los recursos operativos principales, métricas y logout.
- `test:perf` comprueba el endpoint de salud y registra latencia p95.
- El login incluye `data-testid` en logo, entorno, campos, visor de contraseña y envío para poder automatizar una comprobación de UI sin depender del texto visual.

## Checklist visual e interactiva

### Login

- El logo NORTELOG aparece en la cabecera y centrado dentro de la tarjeta.
- El estado `Producción` muestra icono de fábrica, color verde y etiqueta accesible `Entorno de producción`.
- Usuario y contraseña reciben foco visible y conservan sus etiquetas.
- El botón de mostrar contraseña alterna entre mostrar/ocultar sin enviar el formulario.
- Un acceso inválido muestra un mensaje de error y un acceso válido lleva al dashboard.
- En 390×844 no hay scroll horizontal; en escritorio la tarjeta queda centrada.

### Dashboard y navegación

- El menú lateral abre/cierra correctamente en móvil.
- Las pantallas principales cargan sin estado vacío incorrecto: Recepciones, Picking, Expediciones, Ubicaciones, Inventario, Reaprovisionamiento, Productos, Proveedores, Clientes y Movimientos.
- El buscador, filtros, ordenación, paginación, columnas, densidad y exportación CSV responden en tablas.
- El detalle de una fila abre y se puede cerrar sin perder el contexto.

### Operativa y administración

- Las acciones de recepción, picking, expedición, inventario y reaprovisionamiento muestran confirmación o error explícito.
- Herramientas respeta permisos: SQL de solo lectura, bucle acotado, actualización, XML e integraciones.
- Configuración permite guardar consultas/acciones y Administración permite gestionar usuarios, roles y permisos según el rol.
- Las métricas, auditoría y ejecuciones de herramientas quedan protegidas por permisos.

## Criterio de aceptación

Un control se considera revisado cuando tiene una etiqueta accesible, estado de foco visible, respuesta de éxito y respuesta de error cuando aplica. Los flujos críticos deben quedar además cubiertos por una prueba automática o por esta checklist manual reproducible.
