# Despliegue de Almacén SGA

La aplicación queda preparada para dos escenarios:

- **Entorno aislado**: Docker Compose, PostgreSQL local y `INTEGRATION_EXECUTION_MODE=SIMULATED`. No necesita Internet salvo para descargar las imágenes inicialmente. El soporte se guarda en la auditoría local si `SUPPORT_WEBHOOK_URL` está vacío.
- **Entorno publicado**: `docker-compose.production.yml`, Caddy como proxy HTTPS y un dominio público apuntando al servidor. Caddy obtiene y renueva automáticamente el certificado cuando los puertos 80 y 443 están accesibles.

## Publicación con Docker

1. Instala Docker Engine o Docker Desktop en el servidor y clona el repositorio.
2. Crea un `.env` a partir de `.env.example` y cambia como mínimo:

```text
POSTGRES_DB=almacensga
POSTGRES_USER=almacensga
POSTGRES_PASSWORD=una-contraseña-larga-y-unica
DATABASE_URL=postgresql://almacensga:contraseña-url-encoded@postgres:5432/almacensga?schema=public
PUBLIC_DOMAIN=sga.example.com
ACME_EMAIL=soporte@example.com
```

En `PUBLIC_DOMAIN` no debe haber espacios.
La contraseña de `DATABASE_URL` debe estar codificada para URL si contiene caracteres como `@`, `:` o `/`.

3. Aplica el esquema y prepara el usuario inicial solo si se trata de una instalación demo:

```powershell
docker compose -f docker-compose.production.yml run --rm api npx prisma db push
docker compose -f docker-compose.production.yml run --rm api npm run prisma:seed
```

4. Levanta la instalación:

```powershell
docker compose -f docker-compose.production.yml up -d --build
docker compose -f docker-compose.production.yml ps
```

5. Crea un registro DNS `A` o `AAAA` para `PUBLIC_DOMAIN` apuntando al servidor. Cuando la propagación termine, la aplicación estará en `https://PUBLIC_DOMAIN`.

## Antes de usar datos reales

- Sustituir el seed demo por una migración de datos controlada. El esquema actual todavía no tiene un historial Prisma de migraciones versionado.
- Mantener `INTEGRATION_EXECUTION_MODE=SIMULATED` hasta configurar y probar endpoints reales SOAP/REST.
- Configurar `SUPPORT_WEBHOOK_URL` solo con un endpoint interno HTTPS. Sin webhook, soporte puede localizar el incidente en `AuditEvent` usando la referencia mostrada al operario.
- Programar copias de PostgreSQL fuera del volumen Docker y comprobar periódicamente una restauración.
- No subir `.env`, contraseñas, tokens ni capturas de soporte al repositorio.

## CI de GitHub

El workflow `.github/workflows/ci.yml` ejecuta instalación limpia, esquema demo, lint, build, pruebas API, smoke HTTP y rendimiento en cada push a `main`/`master` y en cada pull request.

El workflow `.github/workflows/pages.yml` publica el frontend en GitHub Pages como preview. Ese enlace sirve la interfaz React, pero no ejecuta Express ni PostgreSQL: el login y las operaciones necesitan el backend publicado mediante el Compose de producción o un proveedor equivalente. GitHub Pages puede publicar desde Actions si se habilita como fuente en Settings → Pages; en repositorios privados depende del plan de GitHub.

## API gratuita y base de datos Neon

Para una instalación sin coste, `render.yaml` define únicamente la API Docker gratuita. La base de datos se aloja en Neon Free y se conecta mediante el secreto `DATABASE_URL`; así no se utiliza el PostgreSQL gratuito de Render, que caduca a los 30 días.

1. Crea un proyecto gratuito en Neon y copia su cadena de conexión de PostgreSQL. No la subas al repositorio.
2. Crea un Blueprint en Render usando este repositorio público y añade `DATABASE_URL` en las variables de entorno del servicio `almacensga-api`.
3. Cuando Render entregue la URL de `almacensga-api`, crea en GitHub la variable de Actions `VITE_API_URL` con esa URL, sin añadir `/api`.
4. Vuelve a ejecutar `Deploy frontend preview to GitHub Pages`.

La API ejecutará `prisma db push` antes del despliegue. El primer seed demo puede lanzarse desde el shell de Render con `npm run prisma:seed`, o desde un entorno local conectado a Neon. La API gratuita puede dormirse por inactividad, pero los datos permanecen en Neon.

El repositorio público es `https://github.com/Maek0s/almacensga`. La publicación del frontend se realiza mediante GitHub Actions; el backend y PostgreSQL deben desplegarse en una infraestructura con red y persistencia.
