# Contrato inicial de API

Contrato propuesto para el backend de SmartSupport. La SPA aún usa el adaptador
local; este documento fija el comportamiento que deberá ofrecer el cliente
HTTP. Base sugerida: `/api/v1`. Cuerpo y respuesta usan
`Content-Type: application/json; charset=utf-8`.

## Convenciones

- Identificadores: cadenas opacas no vacías.
- Fechas: ISO 8601 en UTC, por ejemplo `2026-07-29T12:00:00.000Z`.
- Campos desconocidos pueden ignorarse; los enumerados desconocidos se
  rechazan.
- Texto de usuario se almacena como texto, nunca como HTML ejecutable.
- `400` indica JSON o parámetros malformados; `404`, recurso inexistente;
  `409`, conflicto de transición o duplicado; `422`, campo bien formado pero
  inválido; `500`, error inesperado.

Todo error tiene esta forma:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "El reporte contiene campos inválidos",
    "details": [{ "field": "priority", "reason": "Valor no permitido" }]
  }
}
```

## Formas de datos

### Reporte

```json
{
  "id": "01J...",
  "ticketNumber": 42,
  "userName": "María López",
  "contactEmail": "maria@empresa.com",
  "contactPhone": "+52 55 0000 0042",
  "department": "Sistemas",
  "description": "No puede iniciar sesión",
  "priority": "Alta",
  "status": "Pendiente",
  "technician": "Sin asignar",
  "createdAt": "2026-07-29T12:00:00.000Z",
  "activity": []
}
```

`ticketNumber` es entero positivo asignado por el servidor. `userName`,
`contactEmail`, `contactPhone` y `description` son cadenas no vacías.
`department` pertenece a Administración, Almacén, Comercial, Contabilidad,
Finanzas, Infraestructura, Operaciones o Sistemas. `priority` pertenece a
Baja, Media o Alta. `status` pertenece a Pendiente, En progreso o Resuelto.

Una actividad tiene `id`, `message` y `createdAt`. Una notificación añade
`read`, booleano. Un técnico tiene al menos `{ "id": "…", "name": "…",
"active": true }`.

La configuración tiene:

```json
{
  "profile": { "name": "Administrador", "role": "Administrador" },
  "technicians": ["Ana Torres", "Carlos Ruiz"],
  "sla": { "Baja": 72, "Media": 24, "Alta": 8 }
}
```

`role` pertenece a Administrador, Técnico o Consulta. Cada SLA es un número
entre 1 y 720.

## Recursos

### Reportes

- `GET /reports?q=&status=&priority=&technician=&sort=recent`: `200` con
  `{ "items": Report[], "total": 0 }`. Filtros combinados por intersección.
- `GET /reports/{id}`: `200` con el reporte o `404 REPORT_NOT_FOUND`.
- `POST /reports`: recibe los seis campos editables. Devuelve `201`, encabezado
  `Location` y el reporte creado. Puede devolver `422 VALIDATION_ERROR`.
- `PATCH /reports/{id}`: recibe cualquier subconjunto de campos editables.
  Devuelve `200`, `404` o `422`.
- `DELETE /reports/{id}`: devuelve `204` o `404`.
- `PUT /reports/{id}/status`: recibe `{ "status": "En progreso" }`. Devuelve
  `200`, `404`, `409 INVALID_STATUS_TRANSITION` o `422`.
- `PUT /reports/{id}/technician`: recibe `{ "technician": "Ana Torres" }`;
  `Sin asignar` retira la asignación. Devuelve `200`, `404` o
  `422 TECHNICIAN_NOT_AVAILABLE`.
- `POST /reports/{id}/comments`: recibe `{ "message": "…" }`, entre 1 y 160
  caracteres. Devuelve `201` con la actividad, `404` o `422`.
- `GET /reports/{id}/activity`: devuelve `200` con actividades de más reciente
  a más antigua.

Crear, editar, cambiar estado, asignar y comentar producen la misma actividad
y notificación descritas en los casos de uso. Para compatibilidad inicial,
cualquier transición entre los tres estados válidos está permitida.

### Estadísticas

- `GET /metrics`: `200` con `total`, `pending`, `inProgress`, `resolved`,
  `resolutionRate` y `priorities`.
- `GET /reports/{id}/sla`: `200` con `{ "deadline": "…", "overdue": false }`
  o `404`.

### Configuración y técnicos

- `GET /settings`: devuelve `200` con la configuración.
- `PATCH /settings`: recibe perfil o SLA parcial; devuelve `200` o `422`.
- `GET /technicians`: devuelve técnicos activos.
- `POST /technicians`: recibe `{ "name": "…" }`; devuelve `201`, `409
  TECHNICIAN_ALREADY_EXISTS` o `422`.
- `DELETE /technicians/{id}`: devuelve `204`, `404` o `409
  TECHNICIAN_HAS_REPORTS`.

### Notificaciones

- `GET /notifications`: devuelve `200` con la lista.
- `POST /notifications/read-all`: marca todas como leídas y devuelve `200` con
  la lista actualizada.

### Respaldos

- `GET /backups/current`: devuelve `200` con reportes, configuración y
  notificaciones.
- `POST /backups/import`: recibe esa misma forma. Normaliza registros
  compatibles y devuelve `200` con cantidades importadas. Si falta una lista
  de reportes devuelve `400 INVALID_BACKUP`; si un registro no puede
  normalizarse devuelve `422`.

La importación debe ser atómica: un error no sustituye parcialmente los datos.

## Autenticación

- `POST /api/v1/auth/login`: crea sesión en cookie HttpOnly y devuelve el
  usuario actual y un token CSRF.
- `GET /api/v1/auth/me`: valida la sesión y rota el token CSRF.
- `POST /api/v1/auth/logout`: revoca la sesión persistente.
- `GET|POST|PATCH /api/v1/users`: administración exclusiva de `ADMIN`.

Las rutas protegidas documentan `401` para sesión ausente o inválida y `403`
para permisos o CSRF insuficientes.
