# ERP-SMA · Frontend

Interfaz web del flujo contable de ERP-SMA: períodos fiscales, catálogo de
cuentas, asientos, reportes y conciliación bancaria. Es una SPA (React Router 8
en modo framework + Vite + TypeScript + Tailwind) que consume la API Go del
repositorio `erp-sma`.

## Requisitos

- Node.js 22 o superior y npm.
- Para probar de verdad: el backend de `erp-sma` corriendo en `http://localhost:8080`.
- Opcional: Docker y Docker Compose.

## 1. Levantar el backend

En el repositorio del backend:

```bash
cp .env.example .env        # una sola vez
make up                     # PostgreSQL, Redis, MinIO y la API
make migrate-up
make seed                   # administrador + plantilla de cuentas
make demo                   # empresa, catálogo, asientos y extractos de ejemplo
```

El backend queda en `http://localhost:8080` y el almacenamiento público de
reportes en `http://localhost:9100`.

Credenciales del administrador (las de `.env`):

```
admin@despachocontable.com
CambiarEstaClaveSegura2026!
```

## 2. Modo desarrollo

```bash
npm install
npm run dev
```

Abre `http://localhost:5173`. Vite reenvía `/api` y `/healthz` a
`http://localhost:8080` (ver `vite.config.ts`), así que no hay CORS ni URLs
absolutas en el código. Si la API está en otro sitio:

```bash
API_UPSTREAM=http://192.168.1.50:8080 npm run dev
```

## 3. Con Docker

Sirve la app compilada con nginx, que también hace de proxy hacia la API:

```bash
docker compose up --build
```

Abre `http://localhost:3000`. La API se busca en `host.docker.internal:8080`
(el host). Para apuntar a otra máquina:

```bash
API_UPSTREAM=http://192.168.1.50:8080 docker compose up --build
```

Los enlaces de descarga de reportes se firman con `STORAGE_PUBLIC_ENDPOINT`
(`localhost:9100` en desarrollo): el navegador debe poder alcanzar esa URL.
En Docker sobre Linux `localhost:9100` es el host, y el puerto está publicado
por el compose del backend.

## Comandos

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo con recarga. |
| `npm run build` | Compila la SPA en `build/client`. |
| `npm run typecheck` | Genera tipos de rutas y revisa TypeScript. |
| `npm run test` | Pruebas de la aritmética de dinero y los formatos. |

## Qué incluye

- **Inicio**: resumen del período y cifras del estado de situación.
- **Períodos**: crear el año fiscal, cerrar y reabrir meses.
- **Catálogo**: árbol de cuentas VEN-NIF, alta/edición, plantilla base y export CSV.
- **Asientos**: listado con filtros y paginación, alta con partida doble validada,
  publicación, anulación y duplicado.
- **Reportes**: balance, estado de resultados y de situación en pantalla; libros y
  documentos en PDF/Excel generados en segundo plano con barra de progreso y descarga.
- **Banco**: cuentas bancarias, carga de extractos, conciliación automática,
  cruce manual y descarte de movimientos.

Fuera de alcance: pantallas de administración de usuarios y empresas (fase 4).
El administrador se crea con `make seed`; los usuarios y sus accesos se gestionan
por la API.

## Decisiones y límites conocidos

- El token de acceso vive en `localStorage` y se renueva de forma transparente
  ante un `401`. Cerrar sesión revoca el refresh en el servidor.
- Los montos se manejan como texto con aritmética exacta en `BigInt`; nunca se
  convierten a coma flotante.
- Las listas de cuentas y movimientos de un extracto se piden con tope de 200
  filas (el backend no pagina el catálogo completo); la interfaz avisa cuando
  puede haber más.
- El listado de asientos no devuelve las líneas ni los totales (la API los omite
  en `GET /entries`), así que la tabla muestra solo los datos de cabecera. Los
  montos sí aparecen en el detalle de cada asiento.
- Un usuario no administrador no puede leer sus propios permisos porque la ruta
  `/admin/users/{id}/access` está detrás de `RequireAdmin`. Mientras eso no
  cambie, el menú se muestra completo y la API sigue siendo la que autoriza.
- La generación de reportes y la conciliación se refrescan por sondeo cada 1,5 s,
  no por WebSocket.
