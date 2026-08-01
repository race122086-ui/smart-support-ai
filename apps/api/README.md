# SmartSupport API

API Fastify con persistencia PostgreSQL mediante Prisma.

## Entorno local

Desde la raíz del repositorio:

```sh
docker compose up -d postgres
copy .env.example .env
npm install
npm run db:deploy
npm run db:seed
npm run dev:api
```

La API queda en `http://127.0.0.1:3000`, la documentación OpenAPI en
`http://127.0.0.1:3000/documentation` y la comprobación de salud en `/health`.
En otra terminal, `npm run dev` inicia la SPA en `http://localhost:5173`.

Para crear una migración durante desarrollo usa `npm run db:migrate`. En
despliegues usa `npm run db:deploy`; este último no modifica migraciones ya
versionadas.

## Pruebas con PostgreSQL

Las pruebas unitarias usan el repositorio en memoria. Las pruebas de integración
se habilitan con una base exclusiva:

```sh
$env:TEST_DATABASE_URL='postgresql://smartsupport:smartsupport@localhost:5432/smartsupport_test?schema=public'
$env:DATABASE_URL=$env:TEST_DATABASE_URL
npm run db:deploy
npm test
```

No apuntes `TEST_DATABASE_URL` a una base con datos importantes: las pruebas de
integración limpian sus tablas operativas.

API local Fastify de SmartSupport. Durante el plan 1 usa un repositorio en
memoria: al reiniciar el proceso se pierden sus datos y la SPA continúa usando
`localStorage`.

## Configuración

Copiar `.env.example` como `.env` o definir las variables en el entorno antes
de iniciar el proceso. Node no carga archivos `.env` automáticamente en este
proyecto.

| Variable | Predeterminado | Uso |
| --- | --- | --- |
| `API_HOST` | `127.0.0.1` | Interfaz de red local |
| `API_PORT` | `3000` | Puerto HTTP |
| `API_CORS_ORIGIN` | `http://localhost:5173` | Único origen web permitido |
| `API_LOG_LEVEL` | `info` | Nivel de registro estructurado |

La API valida estas variables al arrancar. No debe exponerse públicamente sin
autenticación y autorización.

## Comandos

Desde la raíz del repositorio:

```sh
npm run dev:api
npm run test:api
npm run build:api
```

El endpoint de salud está en `GET /health`, la API en `/api/v1` y la
documentación interactiva en `/documentation`. El documento OpenAPI se
encuentra en `/documentation/json`.

## Correo electrónico

La API usa un `MailService` independiente con Nodemailer como adaptador SMTP. Se eligió
Nodemailer porque ofrece transporte SMTP estándar, mantenido y sustituible sin acoplar
la lógica de tickets a un proveedor específico. Es la única dependencia agregada.

La configuración se recibe exclusivamente mediante `SMTP_HOST`, `SMTP_PORT`,
`SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` y `SMTP_SECURE`. `FRONTEND_URL` o
`WEB_APP_URL` puede definir el origen usado en enlaces a tickets. Si falta parte de la
configuración SMTP, el sistema no intenta enviar y registra únicamente destinatario,
asunto y tipo de evento. Los secretos no deben escribirse en archivos ni registros.
