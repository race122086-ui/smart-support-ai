# Plan 2: agregar PostgreSQL y retirar `localStorage`

## Propósito

Persistir todos los datos operativos en PostgreSQL y conectar la SPA actual a la
API. Al terminar, `localStorage` dejará de ser la fuente de verdad, aunque los
datos anteriores se conservarán para recuperación.

## Modelo de datos propuesto

### `reports`

- `id`: UUID, llave primaria;
- `ticket_number`: entero único;
- datos de contacto y departamento;
- descripción;
- prioridad y estado con restricciones;
- `technician_id`: referencia opcional;
- `created_at` y `updated_at`.

### `report_activities`

- `id`: UUID;
- `report_id`: referencia al reporte;
- tipo y mensaje;
- actor opcional;
- `created_at`.

### `technicians`

- `id`: UUID;
- nombre único normalizado;
- indicador de activo;
- fechas de creación y actualización.

### `notifications`

- `id`: UUID;
- destinatario opcional mientras no exista autenticación;
- mensaje y tipo;
- `read_at`;
- `created_at`.

### `profiles` y `sla_settings`

- perfil actual y rol como configuración compatible;
- una fila de SLA por prioridad;
- restricciones para horas positivas y prioridades válidas.

Cuando se implemente autenticación, `profiles` evolucionará hacia usuarios
verificados sin confundir configuración local con identidad.

## Restricciones e índices

- folio único;
- claves foráneas explícitas;
- técnico opcional, sin guardar el texto `Sin asignar`;
- índices para estado, prioridad, técnico y fecha;
- índice o estrategia adecuada para la búsqueda acordada;
- restricciones de dominio para estado, prioridad y horas SLA;
- borrado de reporte y actividad definido conscientemente;
- fechas generadas por el servidor o la base de datos.

La asignación del siguiente folio debe ser segura ante solicitudes simultáneas;
no se calculará con `MAX + 1` fuera de una transacción.

## Implementación

### 1. Entorno local

- servicio PostgreSQL reproducible mediante contenedor;
- `DATABASE_URL` en `.env.example`;
- comprobación de conexión y salud;
- datos de ejemplo sin información personal real.

### 2. Prisma

- esquema alineado con las entidades;
- migración inicial versionada;
- cliente encapsulado en repositorios;
- comandos separados para desarrollo, despliegue y reinicio de datos de prueba;
- ninguna edición manual de migraciones ya aplicadas.

### 3. Repositorios PostgreSQL

Implementar la misma interfaz usada por los servicios del plan 1. Sustituir el
repositorio en memoria mediante inyección de dependencias, no mediante cambios
en rutas o reglas de negocio.

### 4. Transacciones

Ejecutar de forma atómica:

- crear reporte, actividad inicial y notificación;
- cambiar estado o técnico, agregar actividad y crear notificación;
- importar un respaldo completo;
- asignar un folio;
- cambios relacionados de configuración.

### 5. Conectar el frontend vanilla

Crear un cliente HTTP detrás de la frontera de persistencia del plan 0. Adaptar
las vistas a carga asíncrona, estados de cargando, vacío, error y reintento.

No se migrará todavía el renderizado a React. Esto separa los problemas de
persistencia de los problemas de interfaz.

## Migración segura desde `localStorage`

### Flujo

1. Detectar si existen las tres claves históricas.
2. Ofrecer una importación explícita y mostrar qué se migrará.
3. Crear un respaldo JSON descargable antes de enviar datos.
4. Validar y normalizar en el cliente solo para dar retroalimentación.
5. Volver a validar en la API.
6. Importar todo dentro de una transacción.
7. Usar un identificador o huella de importación para hacerla idempotente.
8. Comparar conteos y relaciones devueltos por la API.
9. Marcar localmente que la migración terminó.
10. Conservar las claves originales; no borrarlas automáticamente.

Si la importación falla, la transacción se revierte y la aplicación conserva el
origen local para un nuevo intento. Una segunda ejecución no debe duplicar
reportes, actividades, técnicos ni notificaciones.

## Respaldo y restauración

La exportación pasará a generarse desde el servidor. La restauración:

- validará versión y estructura;
- tendrá límites de tamaño;
- informará conflictos;
- será transaccional;
- no mezclará datos parcialmente si ocurre un error.

## Pruebas

- migraciones sobre una base vacía;
- repositorios con PostgreSQL real de prueba;
- restricciones y claves foráneas;
- concurrencia de folios;
- transacciones y rollback;
- filtros, paginación e índices esenciales;
- importación de datos antiguos, incompletos, inválidos y repetidos;
- persistencia después de reiniciar la API;
- recorrido manual completo desde la SPA vanilla.

## Entregables

- esquema y migraciones de PostgreSQL;
- repositorios Prisma;
- entorno local reproducible;
- cliente HTTP en la SPA;
- migrador de datos locales;
- respaldo y restauración desde el servidor;
- pruebas de integración.

## Fuera de alcance

- reescribir la interfaz en React;
- borrar automáticamente datos históricos del navegador;
- desplegar una API sin autenticación;
- agregar tiempo real o servicios de correo.

## Criterios de aceptación

- Reiniciar navegador y API no pierde datos.
- Ninguna operación normal usa `localStorage` como fuente de verdad.
- Todas las mutaciones relevantes son transaccionales.
- Los folios no se repiten bajo concurrencia.
- La importación histórica es idempotente y conserva los datos originales.
- La SPA muestra errores de API de forma comprensible y no simula éxito.
- Las pruebas unitarias y de integración pasan.
- La compilación de producción pasa.

## Puerta al siguiente plan

El plan 3 puede iniciar cuando el contrato HTTP sea estable y todos los flujos
funcionen contra PostgreSQL desde el frontend vanilla.

