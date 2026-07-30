# SmartSupport API

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
