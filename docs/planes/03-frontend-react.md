# Plan 3: migrar el frontend a React

## Propósito

Reemplazar el renderizado global con `innerHTML` y el reenlace manual de eventos
por una aplicación de componentes, rutas y estado remoto explícito, conservando
la experiencia visual y todas las capacidades actuales.

## Estrategia

Construir la nueva interfaz en paralelo y activarla solo cuando alcance paridad.
La API y PostgreSQL ya serán estables, por lo que este plan no cambiará reglas
de negocio ni persistencia.

No se copiará literalmente cada función de `main.js`. Se migrará por funciones
de producto y se eliminará la implementación antigua únicamente después de las
pruebas de aceptación.

## Base técnica

- React con componentes funcionales;
- Vite como herramienta de desarrollo y compilación;
- React Router para URLs y navegación;
- TanStack Query para consultar, cachear, invalidar y mutar estado del servidor;
- estado de React para modales, formularios y filtros temporales;
- Context solo para preocupaciones realmente globales;
- CSS y variables existentes, adaptados gradualmente.

No se añadirá Redux de inicio. La mayor parte del estado actual será estado
remoto de la API o estado local de una pantalla.

## Estructura propuesta

```text
apps/web/src/
  app/
    App.jsx
    router.jsx
    query-client.js
  api/
    client.js
  components/
    ui/
    layout/
  features/
    reports/
      api/
      components/
      hooks/
      pages/
    dashboard/
    technicians/
    activity/
    settings/
    notifications/
  styles/
  test/
```

Los componentes comunes no contendrán reglas propias de reportes. Cada función
de producto será dueña de sus consultas, mutaciones y componentes específicos.

## Rutas propuestas

```text
/                    Dashboard
/tickets             Lista y filtros
/tickets/new         Nuevo ticket
/tickets/:id         Detalle e historial
/tickets/:id/edit    Edición
/technicians         Técnicos
/activity            Actividad general
/reports             Métricas
/settings            Configuración
```

Los modales pueden conservarse donde mejoren la experiencia, pero cada pantalla
debe poder recuperarse al recargar y tener una URL útil cuando corresponda.

## Orden de migración

### Incremento 1: shell

- montaje de React;
- layout, barra lateral y encabezado;
- rutas y página no encontrada;
- cliente de API y proveedor de consultas;
- límites de error y mensajes globales.

### Incremento 2: consulta

- dashboard;
- lista de tickets;
- búsqueda, filtros, orden y paginación;
- estados de carga, vacío, error y reintento.

### Incremento 3: operaciones de tickets

- alta, edición y eliminación;
- detalle e historial;
- cambio de estado;
- asignación de técnico;
- comentarios;
- actualización de caché e invalidación correcta.

### Incremento 4: administración

- técnicos;
- perfil y SLA;
- notificaciones;
- métricas;
- importación y exportación.

### Incremento 5: paridad y retiro

- comparación funcional contra la SPA anterior;
- accesibilidad y vistas responsivas;
- eliminación del renderizado antiguo;
- eliminación de adaptadores locales operativos;
- conservación del migrador histórico mientras sea necesario.

## Estado

### Estado del servidor

Reportes, técnicos, configuración, notificaciones y métricas se obtendrán con
TanStack Query. Después de una mutación se actualizará o invalidará la consulta
correspondiente.

### Estado de URL

Búsqueda, filtros, orden y página deben representarse en parámetros de URL para
que una vista pueda compartirse y recuperarse después de recargar.

### Estado local

Campos de formularios, modales, pestañas y elementos expandidos vivirán cerca
del componente que los utiliza. No se duplicarán objetos completos del servidor
en estado global.

## Componentes iniciales

- `AppShell`, `Sidebar`, `Topbar`;
- `DashboardPage`, `StatCard`;
- `TicketsPage`, `TicketFilters`, `TicketList`, `TicketCard`;
- `TicketDetailPage`, `ActivityTimeline`;
- `TicketForm`, `StatusSelect`, `TechnicianSelect`;
- `ConfirmDialog`, `Toast`, `EmptyState`, `ErrorState`, `LoadingState`;
- páginas de técnicos, actividad, métricas y configuración.

## Accesibilidad y seguridad de interfaz

- controles nativos y etiquetas asociadas;
- navegación completa con teclado;
- foco controlado al abrir y cerrar diálogos;
- anuncios adecuados para carga, error y confirmaciones;
- texto del servidor renderizado como contenido, no como HTML;
- confirmación explícita para operaciones destructivas;
- contraste y foco visibles en escritorio y móvil.

React escapará texto por defecto, pero no se usará `dangerouslySetInnerHTML` con
contenido procedente de usuarios o importaciones.

## Pruebas

### Unitarias y de componentes

- filtros y sincronización con URL;
- formularios y validaciones;
- estados de carga, vacío y error;
- modales y foco;
- componentes con respuestas válidas y malformadas.

### Integración

- consultas y mutaciones con la API simulada;
- invalidación de caché;
- errores de red y del servidor;
- navegación y recuperación al recargar.

### Recorridos críticos

- crear y editar un reporte;
- asignar técnico, cambiar estado y comentar;
- filtrar y buscar;
- modificar SLA;
- leer notificaciones;
- exportar e importar;
- conservar datos después de recargar.

Verificar al menos escritorio y móvil, sin errores en consola.

## Entregables

- SPA React con rutas;
- componentes organizados por función;
- cliente de API y manejo de estado remoto;
- pruebas de componentes e integración;
- recorridos críticos automatizados;
- CSS adaptado y accesible;
- retirada de la implementación antigua.

## Fuera de alcance

- cambiar el contrato de negocio sin necesidad;
- agregar Redux por anticipación;
- reescribir el backend;
- borrar datos históricos del navegador;
- implementar funciones nuevas antes de lograr paridad.

## Criterios de aceptación

- Existe paridad con todos los flujos enumerados en el plan maestro.
- Cada ruta se recupera correctamente al recargar.
- No hay llamadas directas de componentes a PostgreSQL ni a `localStorage`.
- El estado remoto no se duplica innecesariamente en Context.
- No se interpola HTML no confiable.
- La navegación por teclado y el foco de diálogos funcionan.
- Las vistas de escritorio y móvil son utilizables.
- Las pruebas unitarias, de integración y de recorridos críticos pasan.
- `npm run build` pasa y no hay errores de consola.

## Resultado final

Una vez superados estos criterios, se elimina el código de renderizado manual y
React se convierte en el único frontend. SmartSupport queda preparado para
incorporar autenticación, despliegue, observabilidad y nuevas funciones sobre
una arquitectura estable.

