# Impresión de etiquetas de ubicación

La demo incorpora una salida de etiquetas desde `Ubicaciones` sin conectarse todavía a una impresora física.

## Opciones estudiadas

### 1. PRN con contenido ZPL — opción recomendada para producción

`PRN` es el archivo raw que se entrega al canal de impresión; el lenguaje que contiene puede ser ZPL. Para Zebra, un formato válido comienza con `^XA` y termina con `^XZ`, según la documentación oficial de [^XA](https://docs.zebra.com/content/tcm/us/en/printers/software/zpl-pg/zpl-commands/%5Exa.html). La demo genera un `.prn` con texto, ubicación, almacén y código de barras Code 128 usando `^BC`, documentado por Zebra en [^BC](https://docs.zebra.com/us/en/printers/software/zpl-pg/c-zpl-zpl-commands/r-zpl-bc.html).

Ventajas: es la salida más cercana a una Zebra real, permite controlar tamaño, posición y densidad en puntos, y no depende del navegador.

Pendiente para una integración real: confirmar modelo de impresora, dpi —203/300—, tamaño exacto de consumible, conexión —USB, red o servidor de impresión—, codificación y estrategia de reintentos.

### 2. Vista imprimible HTML — opción de validación visual

Abre una página de ejemplo con etiquetas dimensionadas en milímetros y estilos de impresión CSS. Es útil para que negocio valide el diseño antes de generar el formato raw.

### 3. PDF — opción intermedia

Adecuado para archivado, revisión o impresión desde oficina. No es la salida más natural para una Zebra directa y necesitaría una generación PDF controlada para garantizar escala 1:1.

## Decisión de la demo

La interfaz ofrece:

- `PRN / ZPL · impresora Zebra`: descarga un ejemplo raw con extensión `.prn`.
- `Vista imprimible · ejemplo visual`: abre una representación imprimible en otra pestaña.
- Tamaños `100 × 50 mm` y `60 × 40 mm`.
- Selección de ubicaciones y vista previa de hasta tres etiquetas.

No se envían trabajos a impresoras, no se modifica PostgreSQL y no se necesita un driver local.
