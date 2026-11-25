# Pruebas del proyecto

Este documento resume cómo ejecutar las pruebas del proyecto y cuál es su estado actual.

## Requisitos

Requisitos comunes:

```bash
node --version
```

- Node.js 24 (igual que CI) y npm.
- Dependencias instaladas con `npm ci` en `backend` y `frontend`.
- Chrome instalado solo para Selenium; Selenium Manager resuelve el controlador.
- MongoDB en replica set solo para integración real y para Newman.

Las unitarias y las pruebas HTTP con stubs no conectan con MongoDB ni alteran datos.

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
npm run test:report
```

Genera texto en consola, `backend/coverage/lcov.info`, `backend/coverage/lcov-report/` y `backend/coverage/jest-results.json`.

### Ejecutar una suite unitaria específica

```bash
cd backend
npx jest src/services/reservationService.test.js --config jest.unit.config.js --runInBand
npx jest src/services/receiptService.test.js --config jest.unit.config.js --runInBand
```

### Estado aproximado de unitarias

La salida más reciente de esta revisión se registra al final de este documento. No se fija un conteo permanente aquí porque cambia cuando se agregan casos.

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

`npm run test:report` también genera cobertura HTML/LCOV y el resultado JSON de esta suite Jest (unitarias y rutas simuladas).

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

Estado: implementada para usuarios, reservas, seguridad, consumos, liquidación, pagos y comprobantes.

Las tres suites `backend/src/integration-tests/` recorren el flujo completo:

```text
request HTTP → middleware real → controlador → servicio real → modelo real → MongoDB de pruebas
```

`usersReservations.integration.test.js` verifica autenticación y perfil, control de roles, disponibilidad y creación/lectura de reservas persistidas, incluido el rechazo de solapamientos. `security.integration.test.js` verifica las restricciones por rol, el rechazo de tokens ausentes, inválidos y expirados, y las respuestas HTTP de error. `consumptionsPayments.integration.test.js` recorre por API la creación y check-in de una reserva, consumos de catálogo y manuales, corrección, anulación, validaciones, check-out, consulta del pago y emisión del comprobante. Después comprueba en MongoDB la liquidación, el stock, el estado de la habitación y los identificadores relacionados.

La URI debe apuntar a una base cuyo nombre termine en `_test`; la configuración aborta antes de conectarse si no cumple esa condición. Las reservas, check-in, consumos de catálogo, correcciones/anulaciones y pagos usan transacciones: MongoDB debe operar como replica set o clúster compatible. Las suites usan datos únicos y eliminan únicamente documentos específicos creados durante la ejecución; nunca eliminan una base.

Configura `MONGODB_TEST_URI` en el entorno o en `backend/.env.test`, que está ignorado por Git. No uses `.env.development` ni credenciales productivas. Ejemplo Bash:

```bash
cd backend
MONGODB_TEST_URI='mongodb://127.0.0.1:27017/hotel_boutique_test?replicaSet=rs0' npm run test:integration
```

Ejemplo PowerShell para la misma base aislada:

```powershell
cd backend
$env:MONGODB_TEST_URI = "mongodb://127.0.0.1:27017/hotel_boutique_test?replicaSet=rs0"
npm run test:integration
```

También se puede guardar `MONGODB_TEST_URI` en `backend/.env.test`, que está ignorado por Git. No copies credenciales productivas ni uses `.env.development`. La configuración de integración está en [`backend/jest.integration.config.js`](./backend/jest.integration.config.js). Supertest llama a `app.js` sin abrir un puerto HTTP.

Las suites no reutilizan `.env.development` ni modifican la base `proyectoSemestre`.

## Ejecutar el servidor para una prueba manual

```bash
cd backend
npm run dev
```

El servidor carga `.env.development`, conecta con MongoDB Atlas y expone la API en el puerto configurado. Detenerlo con `Ctrl+C`.

## Distribución aproximada actual

| Tipo de prueba | Estado | Resultado o cobertura aproximada |
|---|---|---:|
| Unitarias Jest | Implementadas | Consultar el resultado de la ejecución vigente |
| HTTP con Supertest y stubs | Implementadas | Rutas/controladores con middleware o servicios simulados |
| Integración Mongoose/MongoDB real | Implementada | Usuarios, reservas, seguridad, consumos, pagos y comprobantes; replica set requerido |
| Big Bang de API | Implementada | Colección Postman/Newman; el reporte guardado tiene 447 checks aprobados |
| Big Bang desde interfaz | Parcial | Las suites Selenium formales cubren login, habitaciones y disponibilidad; el runner manual permite crear una reserva bajo habilitación explícita. No automatiza aún check-in/consumo/check-out |

## Estrategia de regresión

La regresión protege los flujos existentes cuando se modifica una funcionalidad, un contrato de API, una regla compartida o la configuración de pruebas. Se eligen las suites por impacto y riesgo; las pruebas de nivel inferior no reemplazan las que validan persistencia o interacción real.

### Selección según el cambio

| Área modificada | Regresión mínima recomendada | Ampliar la regresión cuando… |
|---|---|---|
| Autenticación, sesión, usuarios, roles o protección de rutas | Backend Jest completo; unitarias de `App.jsx`; integración `security.integration.test.js` y `usersReservations.integration.test.js` | El cambio afecte el acceso desde navegador: ejecutar también `npm run test:e2e:login`. |
| Habitaciones, disponibilidad o reservaciones | Backend Jest completo; integración `usersReservations.integration.test.js`; unitarias de `RoomsPage`, `AvailabilityPage` y `ReservationsPage` | Cambien selectores o navegación: ejecutar `npm run test:e2e:rooms`. Si cambia el contrato o el flujo API, ejecutar también Newman. |
| Productos, consumos, liquidaciones, pagos o comprobantes | Backend Jest completo; integración `consumptionsPayments.integration.test.js`; unitarias de los componentes frontend afectados | Cambien endpoints o el recorrido entre módulos: ejecutar Newman sobre un entorno aislado. |
| Reportes y consultas agregadas | Suite unitaria del servicio y ruta afectada; pruebas del componente si existe | Cambien cálculos compartidos, permisos o respuestas usadas por otros módulos: ampliar a backend Jest completo y Newman. |
| Page Objects, localizadores o navegación Selenium | Ejecutar `npm run test:e2e:login` para login/dashboard, `npm run test:e2e:rooms` para habitaciones/disponibilidad o el runner manual para creación de reservas | Cambie una abstracción compartida como `BasePage`: ejecutar `npm run test:e2e:suite` y, si aplica, el flujo manual de reserva. |
| Dependencias, configuración de Jest/Vite, CI, middleware común o contratos transversales | Regresión completa: backend, frontend, integración MongoDB, build y CI | Selenium y Newman requieren sus entornos y datos de prueba aislados; registrarlos como no ejecutados si no están disponibles. |

### Orden sugerido para una regresión completa

1. **Backend sin base de datos:** ejecuta unitarias, servicios, utilidades y rutas HTTP con stubs. El comando de CI también genera el reporte de cobertura:

   ```bash
   cd backend
   npm run test:report -- --ci
   ```

2. **Frontend con API simulada:** ejecuta las pruebas de componentes y la validación de configuración del runner E2E. Para cambios frontend, confirma además que Vite compile:

   ```bash
   cd frontend
   npm run test:e2e:config
   npm run test:unit:report -- --ci
   npm run build
   ```

3. **Persistencia real:** cuando el cambio toque MongoDB, transacciones, modelos o flujos entre servicios, ejecuta integración con MongoDB como replica set. Configura `MONGODB_TEST_URI` o `backend/.env.test` con una base cuyo nombre termine en `_test` antes de correr:

   ```bash
   cd backend
   npm run test:integration
   ```

   La configuración rechaza otras bases. Estas suites limpian solo los documentos que crean; no eliminan la base.

4. **Interfaz real:** para cambios en interacción, permisos visibles, navegación o selectores, configura `frontend/.env.e2e` con cuentas y API de QA autorizadas, inicia el frontend con `npm run dev:e2e` y ejecuta la suite que corresponda:

   ```bash
   cd frontend
   npm run test:e2e:login
   npm run test:e2e:rooms
   # O ambas suites formales:
   npm run test:e2e:suite
   ```

   Selenium no forma parte actualmente de GitHub Actions. La suite formal cubre login, habitaciones y disponibilidad; la creación de una reservación se prueba de forma opcional con `npm run test:e2e` y `TEST_CREATE_RESERVATION=true`. No apuntes estas suites a producción ni a cuentas o datos reales; habilita la creación solo con una base aislada y datos identificados.

5. **Contrato completo de API:** ejecuta la colección con Newman cuando cambie un endpoint, permisos o el flujo entre módulos. La colección crea registros y no dispone de limpieza completa; úsala solo con el entorno local de CI o una base desechable/dedicada. El job `newman` de GitHub Actions muestra la configuración reproducible.

6. **Cierre:** revisa el resultado de cada suite seleccionada y los artefactos generados. Antes de integrar, exige que todos los jobs aplicables de CI estén aprobados. Anota explícitamente cualquier suite no ejecutada por falta de Chrome, servicio, credenciales o base compatible; no la marques como aprobada por inferencia.

### Criterios para cerrar una regresión

- Las suites relacionadas con las áreas modificadas terminan sin fallos; las validaciones de infraestructura se distinguen de fallos de producto.
- Cuando se cambia persistencia o una transacción, se ejecuta la integración real y se confirma que la URI usa una base `_test` en replica set.
- Cuando se cambia una interacción crítica, se ejecuta Selenium en QA autorizado; las unitarias frontend con mocks no se presentan como prueba de navegador.
- Cuando se modifica el contrato o una cadena completa de API, Newman pasa en un entorno aislado y sus datos no afectan cuentas reales.
- La CI aplicable queda verde, y los reportes/cobertura se revisan sin depender solo del porcentaje global.
- Credenciales, tokens, variables privadas y datos personales de QA no se agregan a Git ni a los reportes compartidos.

## Estrategia Bottom-up y alcance Big Bang

Las capas se validan de abajo hacia arriba, conservando el nivel real de cada suite:

1. **Modelos (unitarias):** validaciones Mongoose y normalizaciones en `src/unit-tests/*Model*`; no abren una conexión.
2. **Servicios (unitarias):** reglas de negocio y transacciones simuladas en `src/services/*.test.js`; mocks de modelos, producto, habitación y sesiones Mongo. No se presentan como persistencia real.
3. **Rutas/controladores (integración HTTP Top-down con stubs):** Supertest llama endpoints, pero middleware/servicios se sustituyen. Útil para contrato, validación y autorización de rutas.
4. **Servicios/modelos/DB reales (integración):** suites de `src/integration-tests/` conectan a una base `_test`, usan las rutas reales como punto de entrada y validan documentos guardados; Supertest sirve como driver HTTP. Los datos mínimos de usuario/habitación/producto se preparan en modelos para aislar el flujo bajo prueba.
5. **API Big Bang (Postman/Newman):** colección en orden y sobre API activa, integra autenticación, permisos, disponibilidad, reserva, check-in, consumos, check-out, pago y recibo. Los IDs y fechas se pasan entre requests mediante variables del entorno. Esta es la prueba de flujo completo entre módulos.

El frontend no es parte de la colección Postman ni de la integración Jest. La UI tiene unitarias de componentes con API simulada y Selenium real para login, habitaciones/disponibilidad y suites parciales de reserva; no existe aún un flujo Selenium que haga check-in, consumo y check-out. La colección Postman y el integration test cubren esos pasos en API, no en interfaz.

## Evidencia Big Bang de Postman

`backend/postman/Hotel-Boutique-API.postman_collection.json` incluye solicitudes ordenadas que cubren login, consulta de disponibilidad, reserva, check-in, consumo de catálogo, corrección/anulación, check-out, pagos y comprobante, además de validaciones y permisos. El reporte versionado `backend/postman/reportes/reporte-postman-hotel-boutique.json` registra una corrida del 23 de noviembre de 2026: 447 checks aprobados, 0 fallidos y 0 errores. Las capturas adjuntas también muestran ese resultado. Es evidencia histórica de una corrida local de Postman, no una ejecución de Newman ni una garantía del estado actual de QA.

Newman ejecuta el mismo contrato con el environment local; nunca uses el environment de ejemplo con datos reales. La colección crea recursos y carece de endpoints de limpieza, por lo que ejecuta solo contra base de pruebas descartable/dedicada.

No se deben incluir credenciales reales en este README ni en archivos versionados.

## Sprint 3: pruebas del frontend React

### Configuración Jest

Desde la raíz, instala las dependencias de cada paquete:

```bash
cd backend
npm ci
cd ../frontend
npm ci
```

Para el entorno de ejecución se necesita Node.js 24. Las variables privadas se definen en la terminal o en archivos `.env.test` / `.env.e2e` locales ignorados por Git; no se copian secretos en el repositorio. Usa credenciales ficticias en la base `_test`, y credenciales de QA únicamente para las suites Selenium formales.

Resultado de referencia previo, actualizado en el registro de ejecuciones al final:

- 8 suites aprobadas.
- 51 pruebas unitarias aprobadas.
- 0 pruebas fallidas.

Las pruebas están en `frontend/tests/unit`. Usan Jest, React Testing Library y mocks de `frontend/src/services/api.js`; no hacen llamadas ni cambios reales en MongoDB. Cubren:

- Inicio de sesión: válido, credenciales inválidas, respuesta vacía de la API y falta de conexión con el servidor.
- Habitaciones: listado, inventario vacío, respuesta sin lista y error de carga.
- Disponibilidad: resultado, estado vacío, error con detalle de la API y error sin detalle.
- Reservaciones: validación obligatoria, confirmación, periodo sin habitaciones, error en la búsqueda y conflicto 409 al confirmar (con actualización de la disponibilidad).
- Catálogo de productos: productos, estado vacío y error.
- Comprobantes: listado, estado vacío, error con detalle de la API y error sin detalle.
- Pagos realizados (`PaymentsPage.jsx`, 15 pruebas): resumen de cantidad y total recaudado, tabla con referencia, huésped, habitación, fecha, método, valor y estado, filtros y limpieza, paginación, estado vacío, error de la API, detalle de la liquidación (noches, tarifa, subtotal, consumos, cargos adicionales, total liquidado y pagado), cierre del detalle y apertura del comprobante.
- Comprobante de pago (`PaymentReceipt.jsx`, 12 pruebas): encabezado con hotel, número y fecha de emisión, datos del huésped y la estadía, líneas por concepto, totales y método de pago, saldo visible solo si hay diferencia, singular de "noche", carga, error, impresión y cierre del diálogo (botón, Escape y clic fuera).

Los datos de prueba de pagos y comprobantes están en `frontend/tests/unit/fixtures/payments.js`. Replican la forma de las respuestas del backend con valores ficticios y cálculos coherentes (por ejemplo, 1 noche × $180.000 + consumos $38.000 = $218.000).

Cobertura de estos dos componentes: `PaymentReceipt.jsx` 100% de líneas y `PaymentsPage.jsx` 92,7% de líneas.

### Simulación de respuestas de la API

Cada suite reemplaza `frontend/src/services/api.js` con `jest.mock(...)`, así que ninguna prueba de componentes depende del backend ni de MongoDB. Todos los componentes probados cubren los tres tipos de respuesta:

| Componente | Exitosa | Vacía | Fallida |
|---|---|---|---|
| Inicio de sesión (`App.jsx`) | Acceso al panel | `data: {}` sin token | Credenciales inválidas y falta de conexión (`TypeError`) |
| `RoomsPage` | Listado | `rooms: []` y `data: {}` | Error de carga |
| `AvailabilityPage` | Resultados | `rooms: []` | Error con `details` y sin detalle |
| `ReservationsPage` | Reservación confirmada | `rooms: []` en la búsqueda | Error en la búsqueda y conflicto 409 al confirmar |
| `ProductCatalogPage` | Productos | Catálogo vacío | Error de carga |
| `ReceiptsPage` | Comprobantes | `payments: []` | Error con `details` y sin detalle |
| `PaymentsPage` | Pagos y detalle | `payments: []` | Error del listado y del detalle |
| `PaymentReceipt` | Comprobante | Saldo y datos opcionales vacíos | Error al generar el comprobante |

Las respuestas exitosas se simulan con `mockResolvedValue`, y las fallidas con `mockRejectedValue` usando un `Error` con `details` o `status`, igual que los errores que lanza `api.js`.

Cobertura opcional:

```bash
cd frontend
npm run test:unit:report
```

Genera `frontend/coverage/lcov.info`, `frontend/coverage/lcov-report/` y `frontend/coverage/jest-unit-results.json`.

### Pruebas Selenium con Page Object Model

La implementación está separada en:

- `frontend/tests/e2e/pages`: clases POM de login, dashboard, habitaciones, disponibilidad y reservas.
- `frontend/tests/e2e/run.js`: runner manual de login y navegación; cierra el navegador en `finally`.
- `frontend/tests/e2e/login.e2e.test.js` y `rooms-availability.e2e.test.js`: suites Jest formales con POM y cierre del navegador en `afterAll`.
- `frontend/tests/e2e/pages`: POMs; usan esperas explícitas y localizadores por ID, CSS y XPath.

Instalación y navegador:

```bash
cd frontend
npm ci
```

Se necesita Google Chrome instalado. Selenium Manager puede obtener el controlador compatible si no está disponible en el sistema.

Preparar el entorno aislado:

1. Inicia el backend con `backend/.env.test` apuntando a una base `_test` en replica set. Para `dev:test`, define `MONGODB_URI` en ese archivo; para Jest también puedes definir `MONGODB_TEST_URI`:

```bash
cd backend
npm run dev:test
```

2. En otra terminal inicia el frontend:

```bash
cd frontend
npm run dev
```

No ejecutes el runner manual sobre `.env.development`, Atlas de desarrollo ni producción. No uses cuentas, reservaciones o datos reales. Crea una cuenta y datos exclusivos en el entorno aislado.

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

Configura las credenciales solo en la sesión de terminal actual y no las agregues a archivos versionados. El runner requiere que la API responda; el caso de login inválido ahora solo se aprueba con el mensaje exacto de rechazo, tono de error, sin token y en el formulario. Una caída de red ya no cuenta como login inválido aprobado.

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

Evidencia histórica del runner anterior a la corrección del login inválido:

- La corrida previa registró el login inválido como aprobado, pero aceptaba mensajes genéricos de conexión/API y no se considera evidencia suficiente tras la revisión.
- Se corrigió el criterio para exigir el mensaje exacto de rechazo y el estado visual de error; hay que volver a ejecutar el runner contra una API de pruebas activa para validar ese caso.
- El runner manual (`npm run test:e2e`) no se ejecutó en esta validación; la suite formal Jest de login sí se ejecutó por separado y su resultado está registrado abajo.

El runner manual crea un JSON en `frontend/reports/e2e/` para cada ejecución y una captura PNG sanitizada al fallar (limpia inputs y sessionStorage antes de capturar). La captura/report se generan bajo demanda y la carpeta está ignorada por Git. En todos los casos intenta cerrar el navegador con `driver.quit()` en `finally`.

### Suite formal de inicio de sesión (Selenium + Jest)

`frontend/tests/e2e/login.e2e.test.js` automatiza el inicio de sesión como una suite de Jest con Selenium WebDriver y Page Object Model (`LoginPage` y `DashboardPage`). Usa su propia configuración, `frontend/jest.e2e.config.cjs`, separada de las unitarias porque abre un navegador real.

| Grupo | Caso | Qué verifica |
|---|---|---|
| Credenciales válidas | Administrador | Abre el panel, muestra `ROL: ADMIN` y el saludo, y guarda el token de sesión |
| | Recepcionista | Abre el panel con `ROL: RECEPCIONISTA` y el saludo |
| | Cerrar sesión | Vuelve al login con "Sesión cerrada correctamente.", borra el token y el servidor lo revoca (`/auth/me` responde 401) |
| Credenciales inválidas | Contraseña incorrecta | Muestra "Correo o contraseña incorrectos" en tono de error, no abre el panel, no guarda token y conserva el correo para reintentar |
| | Correo no registrado | Muestra el mismo mensaje, sin revelar si el correo existe |
| Validación del formulario | Campos vacíos | El navegador bloquea el envío (`required`) y no aparece ningún mensaje de la API |
| | Correo sin formato | El navegador bloquea el envío (`type="email"`) |

Localizadores: por ID (`admin-email`, `admin-password`, `dashboard-title`), por CSS (`.auth-submit`, `.auth-feedback .feedback-message`, `.sidebar-role`, `.dashboard-layout`) y por XPath (botón "Cerrar sesión" y formulario de acceso).

#### Configuración local segura

Para una corrida local usa exclusivamente la API local conectada a la base de pruebas que hayas autorizado; no apuntes Selenium a producción ni a una base compartida con usuarios reales.

1. Configura `frontend/.env.e2e` desde `frontend/tests/e2e/e2e.env.example` con `TEST_API_URL=http://localhost:3000`, `TEST_APP_URL=http://localhost:5174` y credenciales de cuentas E2E locales. No copies el archivo al repositorio ni compartas sus valores.
2. Inicia el backend en `backend` con el archivo `.env.development` apuntando a la base autorizada de pruebas. Para permitir repeticiones de login E2E sin cambiar el límite predeterminado de la aplicación, establece `AUTH_LOGIN_RATE_LIMIT_MAX=50` solo en el proceso local:

```powershell
cd backend
$env:AUTH_LOGIN_RATE_LIMIT_MAX = "50"
npm run dev
```

El límite sigue siendo 10 intentos por 15 minutos si no se configura esa variable; no la establezcas en producción.
3. En otra terminal, inicia el frontend en el puerto 5174:

```bash
cd frontend
npm run dev:e2e
```

4. En otra terminal, ejecuta la suite:

```bash
cd frontend
npm run test:e2e:login
```

Antes de abrir el navegador, la suite comprueba que existan las variables y que la API y el frontend respondan; si algo falta, indica qué hacer. Para ver el navegador mientras corre, agrega `SELENIUM_HEADLESS=false` en `.env.e2e`.

La suite hace cinco solicitudes de login. El límite es configurable mediante `AUTH_LOGIN_RATE_LIMIT_MAX` para desarrollo local, con valor predeterminado de 10 cada 15 minutos.

Última ejecución formal local: **7/7 pruebas aprobadas** en Chrome. La primera corrida encontró dos problemas de configuración de la prueba (se esperaba el nombre completo aunque la UI muestra el primer nombre, y el límite local de login ya estaba consumido). Se corrigió la expectativa y se reinició la API local con `AUTH_LOGIN_RATE_LIMIT_MAX=50`; el valor predeterminado de la API sigue siendo 10.

### Suite formal de habitaciones y disponibilidad (Selenium + Jest)

`frontend/tests/e2e/rooms-availability.e2e.test.js` automatiza la consulta del listado de habitaciones y la búsqueda de disponibilidad por fechas, con Selenium WebDriver y Page Object Model (`RoomsPage`, `AvailabilityPage` y `DashboardPage`). Se ejecuta como recepcionista de QA.

#### Datos de prueba fijos

Para comprobar resultados concretos (y no solo que la página cargó), la suite prepara antes de abrir el navegador estos datos en la base de QA, mediante `frontend/tests/e2e/support/qaData.js`:

| Habitación | Tipo | Capacidad | Tarifa | Estado | Uso en las pruebas |
|---|---|---|---|---|---|
| `E2E-101` | Sencilla | 1 | $777.100 | Disponible | Siempre libre |
| `E2E-201` | Doble | 2 | $777.200 | Disponible | Siempre libre |
| `E2E-301` | Suite | 3 | $777.300 | Disponible | Tiene una reserva entre hoy+40 y hoy+42 días |
| `E2E-401` | Familiar | 4 | $777.400 | Fuera de servicio | Nunca debe aparecer como disponible |

Los precios 777.xxx permiten aislar estas habitaciones de otras creadas por otras pruebas (por ejemplo, Postman). La preparación es idempotente: solo crea o corrige lo que falte. El administrador de QA solo inicia sesión si hay que crear o corregir habitaciones, y la reserva solo se crea si `E2E-301` sigue libre en esas fechas.

#### Casos

| Grupo | Caso | Qué verifica |
|---|---|---|
| Listado de habitaciones | Carga inicial | El inventario aparece e incluye las 4 habitaciones de prueba |
| | Datos de cada habitación | Número, tipo, descripción, capacidad ("3 personas"), tarifa en pesos y estado ("Disponible" / "Fuera de servicio"), y el resumen "4 habitaciones coinciden con los filtros." |
| | Filtro por tipo | "Suite" deja solo `E2E-301` y muestra "1 habitación coincide…" |
| | Filtro por estado | "Fuera de servicio" deja solo `E2E-401` |
| | Filtro por capacidad mínima | 3 o más personas deja `E2E-301` y `E2E-401` |
| | Sin coincidencias | Muestra "Ninguna habitación coincide" |
| | Validación de precios | Precio máximo menor que el mínimo muestra el error y no consulta |
| | Limpiar filtros | Vuelve a mostrar todo el inventario |
| Disponibilidad por fechas | Fechas por defecto | Hoy → mañana muestra "1 noche" y excluye `E2E-401` |
| | Resultados y total estimado | 3 noches: aparecen las habitaciones libres y `E2E-301` muestra tarifa $777.300 y total $2.331.900 |
| | Fuera de servicio | `E2E-401` no aparece en ninguna búsqueda |
| | Cruce con una reserva | En las fechas reservadas, `E2E-301` no aparece y las demás sí |
| | Día de salida | Desde el día de check-out de la reserva, `E2E-301` vuelve a estar disponible |
| | Filtros de tipo y huéspedes | "Suite" con 3 huéspedes solo devuelve suites con capacidad suficiente |
| | Sin resultados | Precio máximo $0 muestra "No hay habitaciones disponibles" con el mensaje de criterios |
| | Validación de fechas | Check-out anterior al check-in y check-in en el pasado muestran su mensaje |

Localizadores: por ID (`rooms-title`, `filter-*`, `availability-*`), por CSS (`.rooms-table tbody tr`, `.availability-summary`, `.rooms-filters-error`, `.rooms-notice`) y por XPath (botones "Filtrar", "Limpiar" y "Consultar disponibilidad", y opciones del menú lateral).

#### Ejecución

Con el frontend de pruebas corriendo (`npm run dev:e2e`), en otra terminal:

```bash
cd frontend
npm run test:e2e:rooms   # solo habitaciones y disponibilidad
npm run test:e2e:suite   # todas las suites E2E (login + habitaciones y disponibilidad)
npm run test:e2e:suite:report # suite formal y JSON en reports/e2e/jest-results.json
```

La suite inicia sesión una sola vez por la API (el login por la interfaz ya lo cubre su propia suite) y reutiliza ese token en el navegador, así que cada ejecución usa 1 intento de login (2 la primera vez, si hay que crear las habitaciones).

Resultado histórico registrado: **17/17 pruebas aprobadas** en Chrome contra la API de QA, en dos corridas seguidas (la segunda sin crear datos nuevos). No se repitió esta suite en esta revisión porque requiere credenciales de QA y preparaciones de datos autorizadas.

#### Diferencia entre comandos Selenium

- `npm run test:e2e`: runner manual `run.js`; smoke checks de login/navegación en la URL local configurada por `TEST_APP_URL`. No ejecuta Jest.
- `npm run test:e2e:config`: prueba automatizada sin navegador que confirma que solo el texto exacto `true` habilita crear una reserva.
- `npm run test:e2e:login`: suite Jest formal de login válido/inválido y validación del formulario.
- `npm run test:e2e:rooms`: suite Jest formal de listado y disponibilidad con fixtures preparados en QA.
- `npm run test:e2e:suite`: ambas suites Jest formales.
- `npm run test:e2e:suite:report`: ambas suites formales y reporte JSON en `frontend/reports/e2e/jest-results.json`.

Las suites formales apuntan a QA y comprueban disponibilidad de la API y frontend antes de abrir Chrome. Para pruebas de integración visual seguras también se requieren credenciales de QA válidas, frontend en `TEST_APP_URL` y permiso para preparar los fixtures documentados. No se habilitan automáticamente en CI porque esos secretos/datos no están configurados allí.

## Ejecución segura de integración MongoDB

Ejemplo de preparación local con Docker Desktop/replica set (no elimina ni limpia bases):

```powershell
docker run -d --name hotel-test-mongo -p 27017:27017 mongo:8.0 --replSet rs0 --bind_ip_all
docker exec hotel-test-mongo mongosh --quiet --eval "rs.initiate({ _id: 'rs0', members: [{ _id: 0, host: '127.0.0.1:27017' }] })"
cd backend
$env:MONGODB_TEST_URI = "mongodb://127.0.0.1:27017/hotel_boutique_test?replicaSet=rs0"
npm run test:integration
```

Si ya existe un contenedor o replica set, verifica su estado en vez de iniciar otro. No ejecutes estas suites contra una URI sin sufijo `_test`. La integración incluye transacciones; si MongoDB responde que las transacciones solo se permiten en replica set/mongos, habilita un replica set y vuelve a correr. Nunca intentes resolverlo borrando una base.

Para iniciar la API local usada por el runner manual, coloca la URI segura en `backend/.env.test`:

```text
NODE_ENV=test
MONGODB_URI=mongodb://127.0.0.1:27017/hotel_boutique_test?replicaSet=rs0
JWT_SECRET=<secreto-local-de-prueba-de-al-menos-32-caracteres>
JWT_EXPIRES_IN=30m
```

## Reportes y CI

- Backend: `cd backend; npm run test:report` publica localmente cobertura HTML/LCOV y `coverage/jest-results.json`.
- Frontend: `cd frontend; npm run test:unit:report` genera cobertura HTML/LCOV y `coverage/jest-unit-results.json`.
- Integración local: crea `test-reports` y agrega `--json --outputFile=test-reports/jest-integration-results.json` al comando Jest si necesitas un JSON adicional.
- Selenium manual y formal: `frontend/reports/e2e/`; solo el runner manual captura pantalla ante fallo. Las capturas son sanitizadas.
- GitHub Actions ejecuta Jest backend, Jest + Mongo replica set de pruebas, Jest frontend y Newman; sube sus resultados como artefactos `backend-jest-reports`, `backend-integration-results`, `frontend-jest-reports` y `newman-resultados`.
- Selenium no se ejecuta en Actions: necesita Chrome, credenciales restringidas de QA y autorización para preparar sus fixtures. No se consultó ni se declara una corrida de GitHub Actions en esta revisión.

## Validación de QA en esta revisión

La solicitud de solo lectura `GET https://hotel-boutique-api-pruebas.onrender.com/health` respondió HTTP 200 y JSON de salud. La autenticación, disponibilidad con sesión y flujos con datos no se ejecutaron: no existe `frontend/.env.e2e` ni credenciales de QA en este entorno. Para completarlos se requieren las credenciales de prueba de administrador y recepción indicadas por `frontend/tests/e2e/e2e.env.example`, permiso para usarlas y una sesión frontend en `npm run dev:e2e`. No se crearon ni modificaron datos de QA.

## Resultados de la revisión (24 de noviembre de 2026)

| Grupo | Resultado real | Observaciones |
|---|---|---|
| Backend Jest completo | **20 suites, 223 pruebas aprobadas; 0 fallidas** | `npm run test:report`; cobertura: statements 87,73%, branches 72,36%, líneas 87,54%. Incluye unitarias y rutas simuladas, excluye integración Mongo. |
| Servicio de reservas/consumos | **1 suite, 50 pruebas aprobadas; 0 fallidas** | Ejecutada aparte y también incluida en Jest completo. |
| Frontend Jest | **8 suites, 51 pruebas aprobadas; 0 fallidas** | `npm run test:unit:report`; cobertura global statements 29,71%, branches 18,07%, líneas 30,36%. |
| Guarda `TEST_CREATE_RESERVATION` | **1 prueba aprobada; 0 fallidas** | `npm run test:e2e:config`; el valor de texto `"false"` mantiene deshabilitada la creación. |
| Integración Jest/MongoDB | **2 pruebas aprobadas, 2 fallidas** | Dos pruebas sin transacciones (autenticación/permisos) pasaron. Las dos que crean reservas recibieron HTTP 503 al requerirse transacciones. El host Mongo local es standalone (`setName` ausente); no hay Docker ni ejecutable `mongod`. |
| Protección URI de integración | **Rechazo seguro verificado** | Una URI cuyo nombre no termina en `_test` se rechazó antes de conectar. Sin URI, Jest no ejecutó aserciones. |
| Postman/Newman | **No reejecutado en esta revisión** | Evidencia previa guardada: Postman 447 checks aprobados, 0 fallidos. No es una corrida nueva de Newman. |
| Selenium login formal | **7 pruebas aprobadas; 0 fallidas** | Corrida nueva contra frontend/API locales con cuentas E2E; primera ejecución falló por expectativa del saludo y rate limit, luego de ajustar ambos pasó 7/7. |
| Selenium habitaciones / runner manual | **No ejecutados en esta validación** | Requieren sus datos y preparación propia; la corrida de login no valida estas suites. |
| API de QA | **GET /health aprobado, HTTP 200** | Login, habitaciones protegidas y flujos con datos no ejecutados por falta de credenciales. |
| GitHub Actions | **No consultado/ejecutado** | El workflow actualizado queda listo, pero no se afirma que un run remoto haya pasado. |

La integración no se reporta como aprobada: la suite de consumos/pagos no alcanzó el flujo de checkout porque la creación de reserva recibió 503 de transacción en Mongo standalone. La URI usada para la ejecución local apuntaba a una base `_test`, y ambas suites limpian solo documentos propios; no se eliminó ninguna base. Para pasarla localmente se necesita MongoDB compatible con transacciones en replica set, `MONGODB_TEST_URI` terminado en `_test`, por ejemplo `mongodb://127.0.0.1:27017/hotel_boutique_test?replicaSet=rs0`, y ejecutar `cd backend; npm run test:integration`. La colección Postman/Newman requiere además una base desechable/dedicada porque crea recursos que no elimina.

La regresión comprobada en esta revisión incluye autenticación/permisos, reservas/disponibilidad, consumos/cálculos/corrección/anulación, pagos y recibos en backend; y login, habitaciones, disponibilidad, reservas, pagos y comprobantes en pruebas de componentes frontend. La cobertura de UI para check-in/consumos/check-out sigue pendiente de Selenium; esos pasos están cubiertos por API, no por una automatización visual completa.
