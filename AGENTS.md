# Guía para agentes

## Descripción del proyecto

SmartSupport es una SPA de gestión de incidencias técnicas. Está construida con
JavaScript moderno, CSS y Vite, sin framework de interfaz ni backend. La
aplicación se ejecuta completamente en el navegador y persiste reportes,
configuración y notificaciones en `localStorage`.

La interfaz y los textos de producto están en español. Mantén ese idioma y
guarda todos los archivos de texto como UTF-8.

## Estructura relevante

- `index.html`: documento base y punto de montaje `#app`.
- `src/main.js`: estado, renderizado, eventos y persistencia de la aplicación.
- `src/report-utils.js`: funciones puras reutilizables y fáciles de probar.
- `src/style.css`: sistema visual, componentes y reglas responsivas.
- `src/assets/`: recursos importados por el código fuente.
- `public/`: archivos estáticos servidos desde la raíz.
- `tests/`: pruebas con el runner nativo de Node.
- `dist/`: salida generada por Vite; no se edita manualmente.

## Comandos

Ejecuta los comandos desde la raíz del repositorio:

```sh
npm install
npm run dev
npm test
npm run build
npm run preview
```

Para cambios normales, la validación mínima es:

```sh
npm test
npm run build
```

No hay un script de lint configurado. No inventes ni agregues herramientas de
formato, lint o dependencias salvo que la tarea lo requiera expresamente.

## Convenciones de implementación

- Usa módulos ES y conserva el estilo existente: comillas simples, sin punto y
  coma y nombres en `camelCase`.
- Prefiere funciones pequeñas y puras para cálculos, formato, filtros y
  transformaciones. Colócalas en un módulo separado cuando puedan probarse sin
  DOM.
- Mantén en `main.js` la integración con el DOM, los manejadores de eventos y la
  coordinación del estado mientras no exista una refactorización explícita.
- No introduzcas un framework, TypeScript, un backend ni una biblioteca de
  estado para resolver cambios puntuales.
- Reutiliza las constantes de estados, prioridades y claves de almacenamiento;
  evita duplicar cadenas de dominio.
- Conserva los nombres de clases con el patrón BEM ya utilizado y reutiliza las
  variables CSS de `:root` para colores, radios, sombras y tipografía.
- Añade estilos responsivos cuando un cambio afecte la disposición. Verifica
  como mínimo una vista de escritorio y una vista móvil.
- Mantén accesibles los controles: etiquetas asociadas, botones reales para
  acciones, texto alternativo cuando corresponda, foco visible y atributos
  `aria-*` útiles.

## Estado, persistencia y renderizado

- `reports`, `settings` y `notifications` son el estado principal en memoria.
  Después de mutarlos, usa su función `save*` correspondiente y actualiza la
  interfaz.
- Trata los datos de `localStorage` y los archivos importados como datos no
  confiables. Valida su forma, proporciona valores predeterminados y conserva
  compatibilidad con registros creados por versiones anteriores.
- No cambies las claves `smartsupport-reports`, `smartsupport-settings` o
  `smartsupport-notifications` sin implementar una migración.
- Al agregar campos persistentes, incluye valores predeterminados en la carga
  para que los datos existentes sigan funcionando.
- La interfaz se genera principalmente con plantillas HTML y vuelve a enlazar
  eventos después del renderizado. Todo control nuevo debe enlazarse en el
  flujo correcto y seguir funcionando tras `renderApp`, `updateUI` o una
  actualización de la lista.
- Escapa cualquier texto procedente del usuario antes de interpolarlo en
  `innerHTML`. Usa `escapeHtml` o asigna `textContent`; no insertes directamente
  nombres, descripciones, comentarios ni contenido importado.

## Pruebas

- Usa `node:test` y `node:assert/strict`, como en
  `tests/report-utils.test.js`.
- Para lógica nueva, extrae una función pura y cubre el caso esperado, entradas
  vacías y al menos un caso límite relevante.
- Los archivos de prueba deben terminar en `.test.js` para que los descubra
  `node --test`.
- Una compilación exitosa no sustituye las pruebas. Ejecuta ambos comandos de
  validación antes de dar por terminado un cambio.
- Si el cambio es visual o interactivo, realiza además una comprobación manual
  en el navegador: creación y edición de reportes, filtros afectados,
  persistencia tras recargar y ausencia de errores en consola.

## Límites y criterio de finalización

- No edites `node_modules/`, `dist/`, archivos de caché ni logs generados.
- No borres o reemplaces datos del navegador como parte de una migración; adapta
  los datos existentes de forma compatible.
- Mantén los cambios enfocados y evita reformatear archivos grandes sin
  necesidad.
- No incluyas secretos, credenciales ni datos personales reales en código,
  fixtures o capturas.
- Un cambio está completo cuando cumple la solicitud, conserva los flujos
  existentes, añade o actualiza pruebas cuando corresponde y pasan
  `npm test` y `npm run build`.
