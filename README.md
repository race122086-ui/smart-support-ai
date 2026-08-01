# SmartSupport

SmartSupport es una aplicación web para gestionar incidencias de soporte
técnico. Permite registrar y dar seguimiento a tickets, asignar técnicos,
controlar prioridades y SLA, consultar métricas, revisar actividad y administrar
respaldos.

El repositorio es un monorepo de npm compuesto por una SPA en React, una API
HTTP en Fastify y un paquete compartido de contratos. Los datos se almacenan en
PostgreSQL mediante Prisma.

## Tecnologías

- React 19, React Router y TanStack Query
- Vite
- Fastify
- PostgreSQL 17 y Prisma
- Node Test Runner y Vitest
- npm workspaces

## Requisitos

- Node.js 20.19 o posterior
- npm
- Docker con Docker Compose, o una instancia compatible de PostgreSQL

## Inicio rápido

Desde la raíz del repositorio:

```sh
npm install
docker compose up -d postgres
npm run db:deploy
npm run db:seed
```

Después, inicia la API:

```sh
npm run dev:api
```

En otra terminal, inicia la aplicación web:

```sh
npm run dev
```

Servicios disponibles:

- Aplicación web: `http://localhost:5173`
- API: `http://127.0.0.1:3000`
- Estado de la API: `http://127.0.0.1:3000/health`
- Documentación OpenAPI: `http://127.0.0.1:3000/documentation`

La configuración predeterminada coincide con el servicio PostgreSQL definido en
`docker-compose.yml`, por lo que el inicio local básico no requiere variables
adicionales.

## Configuración

`.env.example` contiene las variables disponibles:

| Variable | Valor predeterminado | Descripción |
| --- | --- | --- |
| `DATABASE_URL` | PostgreSQL local de SmartSupport | Cadena de conexión de Prisma; debe configurarse en producción |
| `PORT` | Sin definir | Puerto inyectado por la plataforma; tiene precedencia sobre `API_PORT` |
| `API_HOST` | `127.0.0.1` local; `0.0.0.0` si existe `PORT` | Interfaz donde escucha la API |
| `API_PORT` | `3000` | Puerto alternativo para desarrollo local |
| `API_CORS_ORIGIN` | `http://localhost:5173` | Origen web permitido |
| `API_LOG_LEVEL` | `info` | Nivel de registro de Fastify |
| `VITE_API_URL` | API local en desarrollo; mismo origen en producción | URL pública de la API usada al compilar la SPA |

La API lee estas opciones desde el entorno del proceso; no carga
automáticamente el archivo `.env`. Por ejemplo, en PowerShell:

```powershell
$env:DATABASE_URL='postgresql://smartsupport:smartsupport@localhost:5432/smartsupport?schema=public'
$env:API_PORT='3000'
npm run dev:api
```

## Comandos

| Comando | Función |
| --- | --- |
| `npm run dev` | Inicia la SPA con recarga en caliente |
| `npm run dev:api` | Inicia la API en modo observación |
| `npm start` / `npm run start:api` | Inicia la API sin modo observación |
| `npm test` | Ejecuta todas las pruebas |
| `npm run build` | Compila y valida todos los workspaces |
| `npm run preview` | Sirve localmente la compilación web |
| `npm run db:generate` | Genera el cliente de Prisma |
| `npm run db:migrate` | Crea y aplica una migración de desarrollo |
| `npm run db:deploy` | Aplica las migraciones versionadas |
| `npm run db:seed` | Carga los técnicos iniciales |
| `npm run db:reset` | Reinicia la base de datos de desarrollo |

También existen variantes por workspace, como `test:web`, `test:api`,
`build:web` y `build:api`.

## Funcionalidades

- Dashboard con resumen de incidencias
- Alta, edición, consulta y eliminación de tickets
- Búsqueda, filtros y ordenamiento
- Asignación y administración de técnicos
- Estados, prioridades, vencimientos SLA y comentarios
- Historial de actividad y notificaciones
- Métricas operativas
- Configuración de perfil y tiempos SLA
- Exportación, importación y migración controlada de datos históricos

## Estructura

```text
apps/
  web/          SPA React
  api/          API Fastify y esquema Prisma
packages/
  contracts/    Constantes y contratos compartidos
docs/           Casos de uso, contrato de API y planes técnicos
src/            Módulos históricos compatibles y estilos base
tests/          Pruebas de dominio y persistencia histórica
```

Los puntos de entrada principales son `apps/web/src/main.jsx` para la interfaz
y `apps/api/src/server.js` para la API.

## Base de datos

El esquema está en `apps/api/prisma/schema.prisma` y las migraciones versionadas
en `apps/api/prisma/migrations/`.

Para cambios del esquema durante desarrollo:

```sh
npm run db:migrate
npm run db:generate
```

En despliegues se debe usar `npm run db:deploy`.

## Despliegue

El proyecto no depende de un proveedor específico. Puede desplegarse en
Railway, Render o un servidor Linux siempre que haya Node.js 20.19 o posterior,
una instancia PostgreSQL accesible y un servicio capaz de publicar los archivos
estáticos del frontend.

### 1. PostgreSQL

1. Crea una base de datos y conserva su cadena de conexión como secreto.
2. Configura `DATABASE_URL` en el entorno de la API. No guardes credenciales en
   el repositorio.
3. Instala dependencias y genera Prisma Client:

   ```sh
   npm ci
   npm run db:generate
   ```

4. Aplica exclusivamente las migraciones versionadas:

   ```sh
   npm run db:deploy
   ```

En producción no se debe ejecutar `prisma migrate dev`, `db:reset` ni el seed
como parte del arranque. `db:seed` es una acción manual y opcional para entornos
nuevos controlados. La API crea de forma idempotente sus valores mínimos al
conectarse, pero nunca ejecuta el seed automáticamente.

### 2. API

Configura como mínimo:

- `DATABASE_URL`: conexión PostgreSQL de producción.
- `API_CORS_ORIGIN`: origen HTTPS exacto del frontend, sin ruta y sin `*`.
- `API_LOG_LEVEL`: normalmente `info`.
- `PORT`: normalmente lo inyectan Railway, Render u otro supervisor.

Si la plataforma proporciona `PORT`, la API escucha automáticamente en
`0.0.0.0`. En un servidor Linux también puedes definir explícitamente
`API_HOST=0.0.0.0` y `API_PORT`. Después de aplicar migraciones, inicia el
proceso con:

```sh
npm run start:api
```

La migración y el arranque son pasos separados: el comando de inicio no genera
el cliente, no modifica el esquema y no ejecuta seeds. Comprueba el despliegue
en `GET /health`.

### 3. Frontend

Cuando frontend y API tengan dominios distintos, define la URL pública de la
API antes de compilar:

```sh
VITE_API_URL=https://api.example.com npm run build:web
```

Publica `dist/` como sitio estático y configura el servidor para devolver
`index.html` en rutas de la SPA. `VITE_API_URL` se incorpora durante el build,
no al iniciar el servidor estático. Si se omite en producción, el frontend usa
su mismo origen y espera que `/api/v1` sea dirigido a la API por un reverse
proxy. Ninguna compilación de producción depende obligatoriamente de
`localhost`.

Antes de publicar, ejecuta en CI o en un entorno de construcción limpio:

```sh
npm ci
npm run db:generate
npm test
npm run build
npm run db:deploy
```

Ejecuta `db:deploy` contra la base de datos objetivo como una tarea de release,
no simultáneamente desde todas las réplicas de la API.

## Pruebas y compilación

La validación mínima antes de entregar cambios es:

```sh
npm test
npm run build
```

Las pruebas de integración con PostgreSQL son opcionales y requieren una base
exclusiva mediante `TEST_DATABASE_URL`. No debe usarse una base que contenga
información importante, ya que estas pruebas limpian las tablas operativas.

## Documentación adicional

- `docs/casos-de-uso.md`: comportamiento funcional y reglas de los flujos principales.
- `docs/contrato-api.md`: recursos, validaciones y respuestas del contrato HTTP.
- `docs/planes/README.md`: índice de los planes de evolución técnica del proyecto.

## Autenticación y roles

Todas las rutas bajo `/api/v1`, salvo `POST /auth/login`, requieren una
sesión válida. La sesión usa una cookie HttpOnly y las mutaciones requieren el
encabezado CSRF entregado por `/auth/login` o `/auth/me`. El frontend no
guarda tokens en `localStorage`.

En producción, `NODE_ENV=production` exige `DATABASE_URL`; el repositorio
por archivo continúa disponible únicamente para desarrollo sin esa variable.

### Crear el primer administrador

El comando es manual y no se ejecuta durante el arranque:

```sh
ADMIN_NAME='Administración' \
ADMIN_EMAIL='admin@example.com' \
ADMIN_PASSWORD='una contraseña temporal segura' \
npm run admin:create
```

La contraseña debe tener entre 12 y 128 caracteres e incluir mayúscula,
minúscula y número. El comando rechaza correos duplicados y no imprime la
contraseña. Conviene retirar `ADMIN_PASSWORD` del entorno inmediatamente
después de ejecutarlo.

### Migraciones

Para una base local o de pruebas se deben aplicar migraciones versionadas. No
se usa `db push`:

```sh
npm run db:generate
npm run db:deploy
```

La migración `20260731000000_authentication_and_authorization` agrega usuarios,
sesiones y relaciones opcionales. Los reportes previos quedan deliberadamente
con `created_by_id = NULL`: solo un administrador puede administrarlos; un
técnico puede verlos si están sin asignar o asignados a él. Nunca se infiere un
propietario a partir del nombre o correo histórico.

Los respaldos nuevos usan la versión 2. No contienen hashes de contraseña,
sesiones ni tokens. Los respaldos versión 1 siguen siendo importables y sus
reportes se consideran históricos sin propietario.
