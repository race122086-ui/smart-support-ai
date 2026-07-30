# Plan 1: crear el backend

## Propósito

Crear una API que sea propietaria de las reglas de negocio. Durante este plan,
la SPA actual seguirá usando su adaptador local para no depender todavía de una
base de datos.

## Estructura propuesta

```text
apps/
  api/
    src/
      app.js
      server.js
      routes/
      services/
      repositories/
      schemas/
      errors/
    tests/
  web/
    # SPA actual
packages/
  contracts/
```

El repositorio raíz usará espacios de trabajo de npm para ejecutar web y API
sin mezclar sus dependencias.

## Capas del servidor

- **Rutas:** traducen HTTP a casos de uso.
- **Esquemas:** validan parámetros, consultas, cuerpos y respuestas.
- **Servicios:** contienen las reglas de reportes, asignaciones, actividad,
  notificaciones, SLA y métricas.
- **Repositorios:** abstraen la persistencia.
- **Errores:** convierten errores de dominio a respuestas HTTP consistentes.

Las rutas no accederán directamente a arreglos ni, más adelante, a Prisma.

## API inicial

La especificación exacta se cerrará en el plan 0. Como base:

```text
GET    /health

GET    /api/reports
POST   /api/reports
GET    /api/reports/:id
PATCH  /api/reports/:id
DELETE /api/reports/:id
PATCH  /api/reports/:id/status
PATCH  /api/reports/:id/technician
POST   /api/reports/:id/activities

GET    /api/technicians
POST   /api/technicians
PATCH  /api/technicians/:id

GET    /api/settings
PATCH  /api/settings/profile
PATCH  /api/settings/sla

GET    /api/notifications
PATCH  /api/notifications/read

GET    /api/metrics
GET    /api/backups/export
POST   /api/backups/import
```

`GET /api/reports` aceptará búsqueda, estado, prioridad, técnico, orden,
página y tamaño de página. El servidor aplicará los filtros para no transferir
todos los reportes al navegador.

## Reglas que pasan al servidor

- creación de UUID, fecha y folio;
- valores predeterminados y normalización;
- validación de estados y prioridades;
- asignación solo a técnicos activos;
- registro automático de actividad;
- generación de notificaciones por mutaciones relevantes;
- cálculo de SLA y métricas;
- importación y exportación segura;
- rechazo de campos desconocidos o no editables.

El servidor nunca confiará en un folio, fecha de creación, actividad o
notificación enviados por el cliente cuando deba generarlos él mismo.

## Persistencia temporal

Crear un repositorio en memoria para pruebas y desarrollo de la API. No será una
solución de producción y la SPA no cambiará todavía su fuente de datos. La
interfaz de repositorio quedará preparada para el adaptador PostgreSQL del plan
2.

## Manejo transversal

- JSON Schema para entradas y respuestas;
- formato uniforme de errores con código, mensaje y detalles seguros;
- registro estructurado de solicitudes sin datos personales sensibles;
- CORS limitado al origen configurado;
- variables de entorno validadas y archivo `.env.example`;
- cierre ordenado del servidor;
- endpoint de salud;
- documentación OpenAPI derivada de los mismos esquemas.

## Pruebas

### Unitarias

- servicios y reglas de dominio;
- transiciones, asignaciones, SLA y métricas;
- errores esperados.

### Integración de API

- ruta feliz de cada recurso;
- validación de cuerpo, parámetros y filtros;
- `404` para recursos inexistentes;
- conflictos de folio o duplicados;
- mutación de reporte junto con actividad y notificación;
- importación inválida;
- respuestas sin campos internos.

Las pruebas deben levantar Fastify en memoria, sin abrir un puerto real.

## Seguridad

Este plan no convierte el perfil local actual en autenticación. La API se
limitará a desarrollo local hasta definir identidad, sesiones y permisos. Antes
de un despliegue público será obligatorio:

- autenticar cada solicitud;
- autorizar acciones por rol;
- asociar actividad y notificaciones con un usuario real;
- limitar solicitudes y tamaño de archivos;
- definir política de secretos y orígenes permitidos.

## Entregables

- API Fastify ejecutable;
- contrato OpenAPI;
- repositorio en memoria;
- suite de pruebas del servidor;
- scripts para desarrollo, prueba y compilación de web y API;
- guía de variables de entorno.

## Fuera de alcance

- PostgreSQL;
- migración de datos reales;
- conexión de la SPA a la API;
- React;
- despliegue público.

## Criterios de aceptación

- Todos los endpoints acordados están implementados y documentados.
- Entradas, salidas y errores se validan.
- La lógica de negocio no vive en los manejadores de rutas.
- La API puede probarse completamente con el repositorio en memoria.
- La SPA actual conserva su comportamiento.
- Las pruebas de raíz, web y API pasan.
- La compilación de producción pasa.

## Puerta al siguiente plan

El plan 2 puede iniciar cuando la API tenga un contrato estable y los servicios
no conozcan detalles del repositorio en memoria.

