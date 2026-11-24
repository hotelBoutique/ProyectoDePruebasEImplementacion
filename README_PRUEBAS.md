# Pruebas del proyecto

Este documento resume cómo ejecutar las pruebas del proyecto y cuál es su estado actual.

## Requisitos

Desde la carpeta `backend`:

```bash
npm install
```

Las pruebas unitarias usan mocks y no necesitan conectarse a MongoDB Atlas. Las pruebas HTTP también usan servicios simulados, por lo que no deben modificar datos reales.

## Pruebas unitarias

Las pruebas unitarias cubren principalmente:

- Servicios de autenticación, usuarios, reservas, habitaciones, productos, recibos y reportes.
- Controladores.
- Middleware de autenticación y manejo de errores.
- Modelos y reglas de validación.
- Utilidades de fechas y errores.

La configuración está en [`backend/jest.unit.config.js`](./backend/jest.unit.config.js). Actualmente incluye las pruebas ubicadas en:

- `backend/src/unit-tests/**/*.test.js`
- `backend/src/services/**/*.test.js`
- `backend/src/utils/**/*.test.js`

### Ejecutar todas las unitarias

```bash
cd backend
npm run test:unit
```

### Ejecutar unitarias con cobertura

```bash
cd backend
npm run test:unit -- --coverage --coverageReporters=text
```

### Ejecutar una suite unitaria específica

```bash
cd backend
npx jest src/services/reservationService.test.js --config jest.unit.config.js --runInBand
npx jest src/services/receiptService.test.js --config jest.unit.config.js --runInBand
```

### Estado aproximado de unitarias

Resultado actual:

- 15 suites.
- 136 pruebas aprobadas.
- Aproximadamente 81% de statements cubiertos.
- Aproximadamente 67% de branches cubiertos.
- Aproximadamente 81% de líneas cubiertas.

La cobertura es una referencia técnica, no garantiza por sí sola que todos los escenarios de negocio estén validados.

## Pruebas HTTP de rutas

Estas pruebas usan Jest y Supertest. Validan la comunicación entre las rutas, los controladores y los servicios, pero sustituyen el middleware de autenticación y los servicios mediante Stubs.

Actualmente cubren rutas de:

- Usuarios.
- Habitaciones.
- Reservas.
- Productos.
- Reportes de recepción.

### Ejecutar todas las pruebas de rutas

```bash
cd backend
npx jest src/routes --runInBand
```

### Ejecutar una ruta específica

```bash
cd backend
npx jest src/routes/userRoutes.test.js --runInBand
```

Estas pruebas corresponden a una integración HTTP Top-down. No prueban la persistencia real en MongoDB.

## Pruebas generales del backend

El comando principal ejecuta las pruebas unitarias y HTTP con stubs. La integración real con MongoDB se ejecuta por separado:

```bash
cd backend
npm test -- --runInBand
```

Resultado actual:

- 20 suites.
- 216 pruebas aprobadas.
- Aproximadamente 84% de statements cubiertos.
- Aproximadamente 68% de branches cubiertos.
- Aproximadamente 84% de líneas cubiertas.

Con cobertura:

```bash
cd backend
npm test -- --runInBand --coverage --coverageReporters=text
```

## Estado de integración

Hay dos niveles diferentes que deben distinguirse:

### Integración HTTP con Stubs

Estado: implementada parcialmente.

Las pruebas de rutas ejercitan la cadena:

```text
request HTTP → ruta → middleware simulado → controlador → servicio simulado → respuesta
```

Como referencia aproximada, se prueban 5 de los 7 módulos principales de rutas, equivalente a cerca del 70% de cobertura por módulos de rutas. Este porcentaje no representa cobertura de líneas ni cobertura funcional completa.

### Integración real con MongoDB/Mongoose

Estado: implementada para usuarios y reservas.

La suite `backend/src/integration-tests/usersReservations.integration.test.js` recorre el flujo completo:

```text
request HTTP → middleware real → controlador → servicio real → modelo real → MongoDB de pruebas
```

La suite verifica autenticación y perfil, creación y listado de recepcionistas con control de roles, consulta de disponibilidad y creación/lectura de reservas persistidas. También comprueba el rechazo de una reserva solapada y que ADMIN no pueda crear reservas.

La URI debe apuntar a una base cuyo nombre termine en `_test`; la configuración aborta si no cumple esa condición. Las reservas requieren MongoDB como replica set para soportar transacciones. La suite usa datos únicos por ejecución y limpia únicamente los registros que creó; no elimina la base de datos.

Configura `MONGODB_TEST_URI` en el entorno o en `backend/.env.test` (archivo local ignorado por Git). Ejemplo para una instancia local `rs0`:

```bash
cd backend
MONGODB_TEST_URI='mongodb://127.0.0.1:27017/proyectoSemestre_test?replicaSet=rs0' npm run test:integration
```

La configuración de integración está en [`backend/jest.integration.config.js`](./backend/jest.integration.config.js). Las pruebas usan `app.js` directamente y no abren un puerto HTTP.

La suite no reutiliza `.env.development` ni modifica la base `proyectoSemestre`.

## Ejecutar el servidor para una prueba manual

```bash
cd backend
npm run dev
```

El servidor carga `.env.development`, conecta con MongoDB Atlas y expone la API en el puerto configurado. Detenerlo con `Ctrl+C`.

## Distribución aproximada actual

| Tipo de prueba | Estado | Resultado o cobertura aproximada |
|---|---|---:|
| Unitarias Jest | Implementadas | 136 pruebas; 81% de statements |
| HTTP con Supertest y Stubs | Implementadas parcialmente | 5 de 7 módulos de rutas, aproximadamente 70% por módulos |
| Integración con Mongoose/MongoDB real | Implementada para usuarios y reservas | Suite aislada; ampliar con más flujos |
| Flujos Big Bang completos | Pendiente | 0% implementado |

## Recomendación para la siguiente fase

1. Mantener las unitarias y las pruebas HTTP con stubs aisladas.
2. Ejecutar la integración con una base MongoDB separada del desarrollo y configurada como replica set.
3. Ampliar la suite con check-in, check-out y pagos cuando se prioricen esos flujos.

No se deben incluir credenciales reales en este README ni en archivos versionados.

## Sprint 3: pruebas del frontend React

### Configuración Jest

Desde `frontend`:

```bash
npm install
npm run test:unit
```

El resultado actual es:

- 6 suites aprobadas.
- 13 pruebas unitarias aprobadas.
- 0 pruebas fallidas.

Las pruebas están en `frontend/tests/unit`. Usan Jest, React Testing Library y mocks de `frontend/src/services/api.js`; no hacen llamadas ni cambios reales en MongoDB. Cubren:

- Inicio de sesión válido e inválido.
- Habitaciones: listado y error de carga.
- Disponibilidad: resultado, estado vacío y consulta.
- Reservaciones: validación obligatoria y confirmación.
- Catálogo de productos: productos, estado vacío y error.
- Comprobantes: listado y estado vacío.

Cobertura opcional:

```bash
cd frontend
npm run test:unit -- --coverage --coverageReporters=text
```

### Pruebas Selenium con Page Object Model

La implementación está separada en:

- `frontend/tests/e2e/pages`: clases POM de login, dashboard, habitaciones, disponibilidad y reservas.
- `frontend/tests/e2e/run.js`: casos ejecutables y control de cierre del navegador.
- `frontend/tests/e2e/run.js`: usa esperas explícitas de Selenium y localizadores por ID, CSS y XPath.

Instalación y navegador:

```bash
cd frontend
npm install
```

Se necesita Google Chrome instalado. Selenium Manager puede obtener el controlador compatible si no está disponible en el sistema.

Preparar el entorno aislado:

1. Inicia el backend solo con una base de datos de pruebas:

```bash
cd backend
npm install
npm run dev
```

2. En otra terminal inicia el frontend:

```bash
cd frontend
npm run dev
```

No uses cuentas, reservaciones o datos de producción. Crea una cuenta y datos exclusivos en el entorno de pruebas.

Variables opcionales:

```text
TEST_APP_URL=http://localhost:5173
TEST_USER_EMAIL=<correo-de-prueba>
TEST_USER_PASSWORD=<contraseña-de-prueba>
SELENIUM_HEADLESS=true
TEST_CREATE_RESERVATION=false
TEST_RESERVATION_CHECK_IN=<YYYY-MM-DD>
TEST_RESERVATION_CHECK_OUT=<YYYY-MM-DD>
TEST_GUEST_NAME=<nombre-de-prueba>
TEST_GUEST_EMAIL=<correo-de-prueba>
TEST_GUEST_PHONE=<teléfono-de-prueba>
TEST_GUEST_ID=<identificación-de-prueba>
```

Ejemplos de ejecución en PowerShell sin incluir secretos en archivos:

```powershell
cd frontend
$env:TEST_APP_URL = "http://localhost:5173"
$env:TEST_USER_EMAIL = "<correo-de-prueba>"
$env:TEST_USER_PASSWORD = "<contraseña-de-prueba>"
npm run test:e2e
```

Configura las credenciales solo en la sesión de terminal actual y no las agregues a archivos versionados. Estos datos no son necesarios para ejecutar únicamente el login inválido.

Para habilitar la creación real de una reserva, usa una base aislada y asigna:

```powershell
$env:TEST_CREATE_RESERVATION = "true"
$env:TEST_RESERVATION_CHECK_IN = "<fecha-futura-YYYY-MM-DD>"
$env:TEST_RESERVATION_CHECK_OUT = "<fecha-futura-YYYY-MM-DD>"
```

Ejecución:

```bash
cd frontend
npm run test:e2e
```

Estado ejecutado en este entorno:

- Navegador Chrome iniciado correctamente.
- Login inválido ejecutado y aprobado.
- Frontend levantado con Vite en `http://localhost:5173`.
- Login válido no ejecutado: faltaron credenciales de prueba.
- Navegación, consulta de habitaciones y disponibilidad no ejecutadas: requieren sesión válida.
- Creación de reserva no ejecutada: requiere entorno de base aislado y datos identificados.
- Check-in, consumo y check-out no ejecutados: requieren datos aislados y dependen de la reserva creada.

El navegador se cierra con `driver.quit()` en el bloque `finally`, tanto si la prueba pasa como si falla.
