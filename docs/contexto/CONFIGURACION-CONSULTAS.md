# Configuración portable de consultas y tablas

## Objetivo

Cada instalación puede tener una consulta distinta y decidir cómo se presentan sus resultados. La configuración permite definir:

- SQL parametrizado de solo lectura.
- Columnas visibles y su orden.
- Tipo de dato: texto, numérico, porcentaje, moneda, fecha o estado.
- Decimales y sufijos como `%`, `uds` o `kg`.
- Color de fondo y color de texto.
- Etiquetas visuales para estados.
- Colores condicionales según el valor.
- Filtros, ordenación inicial, acciones y roles autorizados.

## Uso recomendado

1. Entrar con un usuario `Developer` o `Product Owner`.
2. Abrir `Stock`.
3. Pulsar `Configurar vista`.
4. Editar los campos desde el formulario visual.
5. Pulsar `Guardar borrador` para dejar una versión en revisión.
6. Pulsar `Publicar versión` cuando la configuración esté validada.
7. Usar `Exportar JSON` para trasladar la configuración a otra instalación o cliente.

El gerente y los operarios solo consumen la vista publicada. No pueden cambiar el SQL ni sus reglas visuales.

## Configurar tipos de columna

| Tipo | Uso | Ejemplo visual |
| --- | --- | --- |
| `text` | SKU, descripción, ubicación | Texto normal |
| `number` | Unidades, peso, cantidades | `1.250` |
| `percentage` | Ocupación, avance, nivel de servicio | `82,5 %` con barra |
| `currency` | Coste o valoración | `1.250,00 €` |
| `date` | Fechas y horas | `25/08/2026 10:30` |
| `status` | Estado de una operación | Etiqueta coloreada |

Para una columna de porcentaje se recomienda usar `decimals: 1` y `suffix: "%"`. El valor puede venir como `0.825` o `82.5`; la tabla normaliza ambos formatos a `82,5 %`.

## Colores condicionales

En la sección `Formato y colores` de cada campo se pueden añadir reglas. Se evalúan de arriba abajo y se aplica la primera coincidencia.

Ejemplo:

- `Estado` igual a `Disponible` → fondo verde.
- `Estado` igual a `Reservado` → fondo ámbar.
- `Estado` igual a `Bloqueado` → fondo rojo.

También se pueden comparar números con `mayor que`, `menor que`, `mayor o igual` y `menor o igual`. Esto permite, por ejemplo, marcar en rojo una ocupación superior al 90 %.

## Exportación e importación

No hace falta editar archivos para el uso normal. Los botones del editor hacen todo el trabajo:

- `Exportar JSON` descarga un archivo local, por ejemplo `stock-consulta-stock-operativo.json`.
- `Importar JSON` carga ese archivo en otra instalación.
- Tras importarlo hay que revisar el SQL y pulsar `Guardar borrador` o `Publicar versión`.

El JSON exportado no contiene contraseñas, tokens ni credenciales. El parámetro `installationId` se rellena desde la sesión activa y no se debe sustituir por un identificador fijo de otro cliente.

## Contrato JSON portable

La estructura que se transporta entre clientes es esta:

```json
{
  "schemaVersion": 1,
  "resource": "stock",
  "name": "Stock operativo",
  "description": "Existencias disponibles por instalación.",
  "sqlText": "SELECT sku, available, occupied_percent, status FROM stock WHERE installation_id = :installationId",
  "parameters": ["installationId"],
  "columns": [
    {
      "key": "occupied_percent",
      "label": "Ocupación",
      "visible": true,
      "type": "percentage",
      "decimals": 1,
      "suffix": "%",
      "conditions": [
        { "operator": "gte", "value": 90, "background": "#fee2e2", "textColor": "#991b1b" },
        { "operator": "gte", "value": 75, "background": "#fef3c7", "textColor": "#92400e" }
      ]
    },
    {
      "key": "status",
      "label": "Estado",
      "visible": true,
      "type": "status",
      "badge": true,
      "conditions": [
        { "operator": "eq", "value": "Disponible", "background": "#dcfce7", "textColor": "#166534" }
      ]
    }
  ],
  "filters": [
    { "key": "warehouse", "label": "Almacén", "type": "select" }
  ],
  "defaultSort": "occupied_percent desc",
  "actions": ["Exportar", "Ver detalle"],
  "allowedRoles": ["WAREHOUSE_MANAGER", "DEVELOPER", "PRODUCT_OWNER"]
}
```

## Dónde se guarda internamente

La aplicación guarda el contrato en PostgreSQL, en el modelo Prisma `QueryConfiguration`, asociado a:

- `clientId`.
- `installationId`.
- `resource`, por ejemplo `stock`.
- `version` y `status` (`DRAFT` o `PUBLISHED`).

Las columnas, filtros y parámetros se guardan como JSON estructurado. No se necesita crear un archivo JSON dentro del repositorio para que funcione la aplicación.

Para despliegues automatizados, el seed o una herramienta de administración puede cargar el mismo objeto mediante:

```text
PUT /api/query-configurations/stock
POST /api/query-configurations/stock/publish
```

Ambos endpoints requieren sesión de `Developer` o `Product Owner`.

## Trasladar una vista a otro cliente

1. Exportar la vista desde el cliente origen.
2. Revisar el SQL y los nombres de tablas/campos del cliente destino.
3. Importar el JSON en la instalación destino.
4. Confirmar que los parámetros coinciden con el contexto del destino.
5. Guardar como borrador.
6. Probar con un usuario gerente.
7. Publicar si los datos y colores son correctos.

No se debe publicar una vista importada sin revisar el SQL: dos clientes pueden tener nombres de columnas, estados o reglas de negocio diferentes.

## Historial y rollback

Cada borrador guardado crea una copia de la configuración en `QueryConfigurationVersion`. Las versiones publicadas mantienen su número y no sobrescriben el contenido anterior.

Los usuarios administradores pueden consultar el historial mediante:

```text
GET /api/query-configurations/stock/versions
```

Para recuperar una versión concreta:

```text
POST /api/query-configurations/stock/versions/{version}/rollback
```

El rollback no publica directamente: crea un nuevo borrador basado en la versión seleccionada. Así se puede revisar antes de exponerlo a los usuarios de almacén.

## Estado de seguridad

El almacenamiento, el editor visual, la validación de SQL de solo lectura, el historial, el rollback y la auditoría de configuración ya están implementados. Stock ejecuta la consulta publicada sobre la vista lógica `stock` de PostgreSQL usando `:installationId`, `statement_timeout` y un límite de 10.000 filas; la tabla usa las columnas que devuelve la consulta y la configuración visual asociada. El ejecutor de Stock solo permite lectura desde esa vista. La ampliación a otras tablas necesita sus vistas/repositorios y la misma lista blanca antes de habilitarse.
