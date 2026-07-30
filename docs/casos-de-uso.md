# Casos de uso actuales

Este inventario caracteriza el comportamiento que la SPA debe conservar. Las
fechas se representan como cadenas ISO 8601 y todos los identificadores como
cadenas.

## Reportes

| Caso | Entradas | Resultado | Errores | Efectos secundarios |
| --- | --- | --- | --- | --- |
| Crear reporte | Nombre, correo válido, teléfono, departamento, descripción y prioridad | Reporte `Pendiente`, sin técnico, con el siguiente folio y actividad «Reporte creado» | El formulario rechaza correo, teléfono, nombre o descripción vacíos | Persiste reportes, crea notificación y actualiza la vista |
| Editar reporte | Id y los seis campos editables | Reporte actualizado y nueva actividad | Id inexistente: no cambia nada; los controles `required` bloquean campos vacíos | Persiste reportes y muestra confirmación |
| Eliminar reporte | Id confirmado | Reporte y su historial dejan de estar disponibles | Id inexistente: no cambia nada | Persiste reportes y actualiza la vista |
| Cambiar estado | Id y uno de `Pendiente`, `En progreso`, `Resuelto` | Estado reemplazado; actualmente cualquier transición entre estados válidos está permitida | Id inexistente o valor fuera del enumerado | Añade actividad y notificación, persiste y actualiza la vista |
| Asignar técnico | Id y nombre disponible | Técnico reemplazado y actividad de asignación | Id inexistente | Añade notificación, persiste y actualiza la vista |
| Retirar técnico | Id y `Sin asignar` | Elimina la asignación lógica | Id inexistente | Añade actividad y notificación, persiste y actualiza la vista |
| Agregar comentario | Id y texto no vacío de hasta 160 caracteres | Actividad con prefijo `Comentario:` | Id inexistente o texto vacío | Añade notificación, persiste y mantiene abierto el historial |

Los datos antiguos se normalizan en memoria. Si faltan folio, contacto,
departamento, estado, prioridad, técnico, fechas o actividad, se completan con
valores compatibles. Los valores enumerados desconocidos vuelven a sus valores
predeterminados.

## Consultas y cálculos

| Caso | Entradas | Resultado | Errores o límites |
| --- | --- | --- | --- |
| Buscar y filtrar | Texto, estado, prioridad y técnico | Intersección de todos los filtros; busca también correo, teléfono, área, descripción y folio | Texto vacío equivale a todos |
| Ordenar | `recent`, `oldest`, `priority` o `deadline` | Copia ordenada sin mutar la lista | Orden desconocido se trata como `recent` |
| Calcular estadísticas | Lista de reportes | Totales por estado | Lista vacía produce ceros |
| Calcular métricas | Lista de reportes | Estadísticas, tasa de resolución redondeada y distribución por prioridad | Sin reportes, tasa 0 |
| Calcular folio | Folio mayor existente | `INC-` más entero con mínimo cuatro dígitos | Sin reportes inicia en 1 |
| Calcular SLA | Fecha de creación y horas por prioridad | Fecha límite | En el instante exacto aún no está vencido; resueltos nunca aparecen vencidos |
| Sugerir contacto/área | Nombre, folio o descripción | Correo corporativo, teléfono de muestra y área sugerida | Entradas vacías usan valores neutros |

## Configuración y técnicos

Actualizar el perfil recibe nombre y un rol de `Administrador`, `Técnico` o
`Consulta`. Agregar un técnico recibe un nombre no vacío y no duplicado.
Actualizar SLA recibe entre 1 y 720 horas para cada prioridad. Cada operación
persiste la configuración; los cambios también generan una notificación.

Al leer datos antiguos o malformados se aplican estos valores:

- perfil `Administrador`, rol `Administrador`;
- técnicos `Ana Torres`, `Carlos Ruiz` y `Laura Méndez`;
- SLA: Baja 72 h, Media 24 h y Alta 8 h.

## Notificaciones

Crear una notificación recibe un mensaje y genera id, fecha y `read: false`.
Listar conserva el orden más reciente primero. Marcar todas como leídas
reemplaza `read` por `true` sin alterar los demás campos. Los registros
malformados se normalizan antes de mostrarse.

## Respaldos

Exportar produce JSON con `reports`, `settings` y `notifications`. Importar
requiere un objeto JSON y una propiedad `reports` que sea una lista. Reportes,
configuración y notificaciones se normalizan antes de sustituir el estado.
Ante JSON inválido o una forma incorrecta, no se cambia ningún dato y se
informa al usuario.
