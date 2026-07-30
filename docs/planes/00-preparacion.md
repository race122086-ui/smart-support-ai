# Plan 0: preparar el dominio y los contratos

## Propósito

Separar las reglas que hoy viven en `src/main.js` sin cambiar la interfaz ni la
persistencia. Este plan crea una base comprobable para que el backend implemente
el mismo comportamiento.

## Alcance

### 1. Inventariar el comportamiento actual

Documentar como casos de uso:

- crear, editar y eliminar un reporte;
- cambiar su estado;
- asignar o retirar un técnico;
- agregar comentarios y actividad;
- calcular folios, estadísticas, métricas y vencimientos SLA;
- administrar técnicos y configuración;
- crear y leer notificaciones;
- importar y exportar respaldos.

Registrar para cada caso sus entradas, resultado, errores y efectos
secundarios.

### 2. Definir el vocabulario del dominio

Centralizar y reutilizar:

- estados: `Pendiente`, `En progreso`, `Resuelto`;
- prioridades: `Baja`, `Media`, `Alta`;
- roles actuales;
- departamentos;
- valores predeterminados de configuración;
- formato de folio y reglas SLA.

Definir las formas válidas de reporte, actividad, técnico, notificación y
configuración. Los datos antiguos e importados deben normalizarse antes de
usarse.

### 3. Extraer lógica pura

Mover desde `main.js` a módulos sin DOM:

- creación y normalización de reportes;
- generación de datos de contacto sugeridos;
- sugerencia de departamento;
- filtrado y orden;
- cálculo de fecha límite y condición de vencimiento;
- estadísticas y métricas;
- creación de actividades y notificaciones;
- validación y normalización de respaldos.

`main.js` conservará temporalmente las plantillas, eventos y coordinación de
interfaz.

### 4. Crear una frontera de persistencia

Encapsular las tres claves actuales detrás de funciones o un repositorio local.
El resto de la aplicación no debe llamar directamente a `localStorage`.

La interfaz propuesta es conceptual; se ajustará a los casos de uso reales:

```js
reportsRepository.list(filters)
reportsRepository.getById(id)
reportsRepository.create(input)
reportsRepository.update(id, changes)
reportsRepository.remove(id)
settingsRepository.get()
settingsRepository.update(changes)
notificationsRepository.list()
notificationsRepository.markAllAsRead()
```

Esto permitirá sustituir el adaptador local por un cliente HTTP en el plan 2.

### 5. Especificar el contrato de la API

Crear una primera especificación de recursos, campos, validaciones, códigos de
estado y errores. El contrato debe representar identificadores como cadenas,
fechas en ISO 8601 y valores enumerados sin depender del DOM.

### 6. Ampliar pruebas

Cubrir como mínimo:

- entradas válidas, vacías y malformadas;
- compatibilidad con reportes antiguos que no tienen todos los campos;
- filtros combinados y orden;
- transiciones de estado aceptadas y rechazadas;
- SLA en el límite exacto y vencido;
- importación inválida y valores predeterminados;
- escape o tratamiento seguro de texto introducido por usuarios.

## Entregables

- módulos de dominio puros;
- adaptador único para `localStorage`;
- contrato inicial de la API;
- pruebas de caracterización del comportamiento actual;
- `main.js` más pequeño, sin una reescritura visual.

## Fuera de alcance

- crear el servidor;
- agregar una base de datos;
- cambiar la apariencia;
- migrar a React;
- implementar autenticación.

## Riesgos y mitigación

- **Cambiar comportamiento al extraer código:** crear primero pruebas de
  caracterización.
- **Normalizar datos antiguos de forma destructiva:** aplicar valores
  predeterminados en memoria y conservar las claves existentes.
- **Invertir tiempo en código que React eliminará:** extraer solo dominio y
  persistencia; no dividir todas las plantillas HTML.

## Criterios de aceptación

- No existen llamadas directas a `localStorage` fuera del adaptador local.
- Los flujos actuales funcionan igual después de recargar.
- Los registros antiguos e importados siguen siendo compatibles.
- La lógica extraída no depende de `document`, `window` ni elementos del DOM.
- Las pruebas nuevas y existentes pasan.
- `npm run build` pasa.

## Puerta al siguiente plan

El plan 1 puede iniciar cuando el contrato de datos y los casos de uso tengan
pruebas suficientes para implementarse en el servidor sin copiar código de
interfaz.

