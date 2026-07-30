# SmartSupport Web

SPA React de SmartSupport. Usa React Router para navegación y parámetros de
filtros, y TanStack Query para consultas, mutaciones e invalidación de caché.

## Desarrollo

La aplicación requiere la API disponible en `http://localhost:3000` de forma
predeterminada. Puede cambiarse con `VITE_API_URL`.

Desde la raíz del repositorio:

```sh
npm run dev
npm run dev:api
npm test
npm run build
```

## Estructura

- `src/app/`: proveedores, router y cliente de consultas.
- `src/api/`: cliente HTTP y hooks de datos remotos.
- `src/components/`: layout y componentes reutilizables.
- `src/features/`: pantallas y componentes por función de producto.
- `src/styles/`: ajustes visuales propios de React.
- `src/test/`: configuración de pruebas de componentes.

Los datos operativos provienen exclusivamente de la API. El adaptador histórico
de `localStorage` solo se conserva para ofrecer una importación explícita,
respaldada e idempotente desde la pantalla de configuración.
