# Plan maestro de evolución de SmartSupport

## Objetivo

Transformar la SPA actual en una aplicación cliente-servidor mantenible, con
persistencia centralizada y un frontend basado en componentes, sin interrumpir
los flujos que ya funcionan.

La migración se realizará en cuatro planes secuenciales:

1. [Preparar el dominio y los contratos](./00-preparacion.md).
2. [Crear el backend y trasladar la lógica de negocio](./01-backend.md).
3. [Agregar PostgreSQL y retirar `localStorage` como fuente de verdad](./02-base-de-datos.md).
4. [Migrar el frontend a React](./03-frontend-react.md).

No se inicia un plan hasta que el anterior cumpla todos sus criterios de
aceptación. Cada plan debe terminar con `npm test`, `npm run build` y un commit
propio.

## Diagnóstico actual

- La aplicación es una SPA de Vite escrita en JavaScript.
- `src/main.js` tiene alrededor de 1,500 líneas y combina estado, reglas de
  negocio, persistencia, plantillas HTML y eventos del DOM.
- Los reportes, la configuración y las notificaciones se guardan en tres claves
  de `localStorage`.
- Las entidades visibles son reportes, actividades, técnicos, notificaciones,
  perfil y tiempos SLA.
- Solo hay pruebas unitarias para estadísticas y formato de folios.
- No existe autenticación real: el perfil y el rol actuales son configuración
  local, no una identidad verificada.

## Arquitectura objetivo

```text
Navegador
  React + React Router + TanStack Query
                  |
                  | HTTP/JSON
                  v
API Fastify
  rutas -> casos de uso -> repositorios
                            |
                            v
                     PostgreSQL + Prisma
```

La propuesta mantiene JavaScript y Vite. No introduce TypeScript, un
meta-framework ni una biblioteca global de estado durante esta migración.

### Stack propuesto

- Backend: Node.js con Fastify.
- Contrato: HTTP/JSON, JSON Schema y documentación OpenAPI generada.
- Base de datos: PostgreSQL.
- Migraciones y acceso a datos: Prisma.
- Frontend: React sobre Vite.
- Rutas del cliente: React Router.
- Estado remoto: TanStack Query.
- Estado local de interfaz: estado de React y, cuando sea necesario,
  `useReducer` o Context.

React es la recomendación para este proyecto porque permite dividir las vistas
actuales en componentes y conservar Vite y el CSS existente. Vue sería una
alternativa válida, pero debe elegirse una sola opción antes de iniciar el plan
3 para evitar mantener dos implementaciones.

## Principios de la migración

- El servidor será la única autoridad de las reglas de negocio.
- El navegador no escribirá directamente en la base de datos.
- Las respuestas y entradas de la API se validarán con esquemas.
- Los datos existentes del navegador no se borrarán durante la migración.
- La importación desde `localStorage` será validada, transaccional e idempotente.
- El frontend actual seguirá disponible hasta alcanzar paridad funcional.
- No se desplegará la API públicamente sin autenticación y autorización reales.

## Orden y dependencias

| Plan | Resultado verificable | Depende de |
| --- | --- | --- |
| 0. Preparación | Dominio probado y contrato inicial definido | Estado actual |
| 1. Backend | API funcional y probada con repositorio en memoria | Plan 0 |
| 2. Base de datos | API persistente y frontend vanilla consumiendo la API | Plan 1 |
| 3. Frontend | React reemplaza el renderizado manual con paridad funcional | Plan 2 |

## Alcance funcional que debe conservarse

- Alta, edición y eliminación de reportes.
- Folios consecutivos.
- Búsqueda, orden y filtros por estado, prioridad y técnico.
- Cambio de estado y asignación de técnico.
- Comentarios e historial de actividad.
- Dashboard, métricas y cálculo de SLA.
- Administración de técnicos, perfil y configuración.
- Notificaciones y marcado como leído.
- Importación y exportación de respaldos.
- Persistencia después de recargar.
- Vistas responsivas y controles accesibles.

## Decisiones pendientes antes de producción

Estas decisiones no bloquean los planes 0 y 1, pero sí un despliegue real:

- proveedor de identidad o estrategia de autenticación;
- modelo de organizaciones: instancia única o múltiples empresas;
- infraestructura de despliegue y copias de seguridad;
- política de retención y auditoría;
- correo, tiempo real u otros canales para notificaciones.

## Definición global de terminado

La migración completa termina cuando:

- no hay lecturas ni escrituras operativas en las claves
  `smartsupport-reports`, `smartsupport-settings` y
  `smartsupport-notifications`;
- todas las mutaciones pasan por la API y se conservan en PostgreSQL;
- el frontend React cubre todos los flujos actuales;
- existen pruebas unitarias, de integración y de los recorridos críticos;
- la compilación de producción termina sin errores;
- no hay errores de consola en escritorio ni móvil;
- los datos locales anteriores pueden importarse sin pérdida y sin duplicarse.

