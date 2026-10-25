# Frontend

Interfaz inicial del sistema hotelero construida con React y Vite. El servidor de desarrollo usa un proxy para comunicarse con la API de Express.

## Requisitos

- Node.js 20.19+ o 22.12+.
- MongoDB disponible para el backend.

## Preparar el backend

En una terminal, desde la raíz del repositorio:

```bash
cd backend
npm ci
```

La configuración local del backend se carga desde `backend/.env.development`. Si todavía no existe, copia `.env.example` con ese nombre y configura al menos `MONGODB_URI` y `JWT_SECRET`.

Inicia el backend:

```bash
npm run dev
```

Por defecto, la API queda en `http://localhost:3000`. Mantén esta terminal abierta.

## Preparar y levantar el frontend

En otra terminal, desde la raíz del repositorio:

```bash
cd frontend
npm ci
npm run dev
```

Abre [http://localhost:5173](http://localhost:5173). La pantalla inicial consulta `/health` y muestra el estado de conexión del backend.

Vite redirige las solicitudes a `/health` y `/api` al backend. El destino predeterminado es `http://localhost:3000`. Para cambiarlo, crea `frontend/.env.local` con:

```env
VITE_BACKEND_URL=http://localhost:3000
```

El cliente API usa `/api/v1` como base. Puedes sobrescribirlo definiendo `VITE_API_BASE_URL` en `frontend/.env.local`.

## Comandos

```bash
npm run dev      # inicia Vite en el puerto 5173
npm run build    # genera la compilación de producción en dist/
npm run preview  # sirve localmente la compilación de dist/
```

## Estructura

```text
frontend/
├── index.html
├── vite.config.js
└── src/
    ├── App.jsx
    ├── main.jsx
    ├── assets/
    ├── components/
    ├── pages/
    ├── services/
    │   └── api.js
    └── styles/
```
