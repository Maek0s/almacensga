# Almacén SGA — prueba local

Prueba mínima del monorepo con React/Vite, Express, Prisma, PostgreSQL y Caddy.

## Contexto del proyecto

La documentación reutilizable para nuevas sesiones está en [docs/contexto](./docs/contexto/):

- [CONTEXTO.md](./docs/contexto/CONTEXTO.md): arquitectura, decisiones y estado actual.
- [PENDIENTES.md](./docs/contexto/PENDIENTES.md): backlog de trabajo.
- [PRODUCCION.md](./docs/PRODUCCION.md): despliegue aislado o publicado con Docker y HTTPS.

## Dominio local

Añade estas entradas al archivo de hosts de Windows (`C:\\Windows\\System32\\drivers\\etc\\hosts`). La forma recomendada es abrir PowerShell como Administrador y ejecutar:

```powershell
.\scripts\setup-hosts.ps1
```

También puedes añadirlas manualmente:

```text
127.0.0.1 almacensga.es
127.0.0.1 api.almacensga.es
```

La aplicación quedará disponible en:

- `http://almacensga.es`
- `http://api.almacensga.es/api/health`

## Arranque

```powershell
docker compose up --build
```

Servicios directos para diagnóstico:

- Frontend Vite: `http://localhost:5173`
- API Express: `http://localhost:3000/api/health`
- PostgreSQL: `localhost:5432`

Para detenerlo:

```powershell
docker compose down
```

Después de levantar PostgreSQL por primera vez, preparar los datos demo:

```powershell
docker compose exec api npx prisma db push --accept-data-loss
docker compose exec api npm run prisma:seed
```

Credenciales demo:

```text
Gestor de almacén: jgarcia / demo123
Developer: adev / demo123
Product Owner: powner / demo123
```

El gestor puede operar Stock, Recepciones, Picking y Expediciones, pero no administra instalaciones, usuarios, roles, integraciones ni SQL. Developer y Product Owner pueden administrar configuración y herramientas. La aplicación incluye autenticación contra PostgreSQL, permisos por rol, rate limiting compartido, agregados Prisma tipados, operaciones, herramientas, integraciones simuladas/REST/SOAP y auditoría. La migración a `better-auth`, las colas, la observabilidad avanzada y las credenciales externas quedan como evolución documentada. No se incorpora Resend.

Verificaciones reproducibles:

```powershell
npm run lint
npm run build
npm run test:e2e
npm run test:perf
docker compose exec api npm test
```

El inventario completo de pantallas y funcionalidades está en [docs/contexto/INVENTARIO-FUNCIONAL.md](docs/contexto/INVENTARIO-FUNCIONAL.md).
