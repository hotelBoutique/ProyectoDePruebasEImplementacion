# Backend API REST — Autenticación JWT y Autorización por Roles

## 1. Descripción

Este proyecto contiene la base de una API REST construida con **Node.js y Express**, utilizando **MongoDB con Mongoose** como sistema de persistencia.

Actualmente el proyecto está orientado a construir una arquitectura backend organizada por responsabilidades y cuenta con:

- Configuración del servidor Express.
- Conexión con MongoDB.
- Variables de entorno.
- Validación de datos de entrada.
- Manejo centralizado de errores.
- Logging básico.
- Protección HTTP con Helmet.
- Configuración de CORS.
- Compresión de respuestas.
- Rate limiting.
- Registro y autenticación de usuarios.
- Hash de contraseñas con bcrypt.
- Generación y validación de tokens JWT.
- Middleware de autenticación.
- Autorización basada en roles.
- Ruta para consultar el usuario autenticado.



---

# 2. Arquitectura actual

La estructura utilizada actualmente es:

```text
backend/
│
├── .env.development
├── .env.example
├── .gitignore
├── package.json
│
└── src/
    ├── server.js
    ├── app.js
    │
    ├── config/
    │   ├── env.js
    │   └── database.js
    │
    ├── constants/
    │   └── roles.js
    │
    ├── models/
    │   └── user.js
    │
    ├── services/
    │   ├── authService.js
    │   └── userService.js
    │
    ├── controllers/
    │   ├── authController.js
    │   └── userController.js
    │
    ├── routes/
    │   ├── authRoutes.js
    │   ├── adminRoutes.js
    │   └── userRoutes.js
    │
    ├── middlewares/
    │   ├── authMiddleware.js
    │   ├── validate.js
    │   └── errorHandler.js
    │
    ├── utils/
    │   ├── AppError.js
    │   ├── catchAsync.js
    │   └── logger.js
    │
    └── scripts/
        └── migrateUserRoles.js
```

La arquitectura puede entenderse como una combinación de:

**Route → Middleware → Controller → Service → Model → Database**

y componentes transversales como configuración, logging y manejo de errores.

---

# 3. Flujo general de una petición

Una petición HTTP sigue aproximadamente este recorrido:

```text
Cliente
   │
   ▼
Express
   │
   ├── Helmet
   ├── CORS
   ├── Rate Limit
   ├── JSON Parser
   ├── Compression
   └── Morgan
   │
   ▼
Route
   │
   ▼
Validación / JWT
   │
   ▼
Controller
   │
   ▼
Service
   │
   ▼
Model
   │
   ▼
MongoDB
```

La idea principal es que cada capa haga una sola clase de trabajo.

---

# 4. `server.js`

## Objetivo

Es el punto de entrada del backend.

Su responsabilidad principal es:

1. Cargar la configuración.
2. Conectar con MongoDB.
3. Iniciar el servidor HTTP.
4. Gestionar el cierre ordenado del servidor.

Conceptualmente:

```text
server.js
   │
   ├── configuración
   ├── conexión a BD
   └── app.listen()
```

La lógica de negocio no debería colocarse aquí.

---

# 5. `app.js`

## Objetivo

Contiene la configuración principal de Express.

Aquí se registran los middleware globales y las rutas.

Entre los componentes utilizados se encuentran:

- `helmet`
- `cors`
- `express.json`
- `compression`
- `express-rate-limit`
- `morgan`

El login tiene un límite de 10 intentos cada 15 minutos, además del límite
general de la API.

El `app.js` se encarga de configurar la aplicación, mientras `server.js` se encarga de ponerla en ejecución.

---

# Registro de habitaciones

Las rutas de habitaciones requieren un token de sesión. Solo un administrador puede
registrar habitaciones con `POST /api/v1/rooms`; administradores y recepcionistas
pueden consultar el inventario con `GET /api/v1/rooms`. La actualización de
habitaciones con `PATCH /api/v1/rooms/:id` sigue restringida al administrador.
Los campos obligatorios al registrar son `number`, `type` y `price`; `description`
y `capacity` son opcionales. Si no se proporciona `status`, queda como `disponible`.
Los estados admitidos son `disponible`, `ocupada`, `mantenimiento` y `fuera de servicio`.

El número debe ser único. La creación responde con HTTP `201` y la actualización
con HTTP `200`. Un número duplicado responde con HTTP `409`. Cambiar el estado a
`fuera de servicio` desactiva la habitación sin eliminarla del inventario; para
reactivarla, un administrador puede cambiarla de nuevo a un estado operativo.

# Registro de reservaciones

Solo un recepcionista puede registrar una reservación con
`POST /api/v1/reservations`; los datos requeridos son los del huésped (nombre, correo, teléfono e
identificación), `roomId`, `checkIn`, `checkOut` y `nightlyRate`. Las fechas usan
el formato `AAAA-MM-DD`; el check-out debe ser posterior al check-in. La API
guarda la tarifa aplicada como una copia del acuerdo y calcula noches y total.
una reservación correcta responde con HTTP `201` y un comprobante. Un administrador
que intente crearla recibe HTTP `403`. Administradores y recepcionistas pueden
consultar disponibilidad.

Antes de elegir una habitación, el frontend consulta
`GET /api/v1/reservations/availability?checkIn=AAAA-MM-DD&checkOut=AAAA-MM-DD`.
La disponibilidad se calcula para el rango (check-in incluido, check-out
excluido), excluye habitaciones fuera de servicio y con reservaciones activas
superpuestas. Las fechas se vuelven a comprobar dentro de una transacción al
confirmar, evitando que dos solicitudes concurrentes asignen la misma habitación
en el mismo periodo. La transacción también impide persistir cambios parciales.

MongoDB debe ejecutarse como replica set (o clúster sharded) para habilitar
transacciones. En entornos locales configura el replica set antes de usar la
creación de reservaciones.

# 6. `config/env.js`

## Objetivo

Centralizar la configuración obtenida desde las variables de entorno.

Aquí se cargan valores como:

```env
PORT=3000
MONGODB_URI=...
JWT_SECRET=...
JWT_EXPIRES_IN=1d
CORS_ORIGIN=http://localhost:5173
```

Además, se comprueba que existan variables obligatorias como:

- `MONGODB_URI`
- `JWT_SECRET`

`JWT_SECRET` debe tener al menos 32 bytes. Para generar una clave segura:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Esto evita que diferentes partes del proyecto accedan directamente a `process.env` de manera descontrolada.

---

# 7. `config/database.js`

## Objetivo

Responsable únicamente de conectar la aplicación con MongoDB mediante Mongoose.

La conexión utiliza:

```text
MONGODB_URI
```

Por ejemplo:

```env
MONGODB_URI=mongodb://127.0.0.1:27017/proyectoSemestre
```

En este caso:

```text
mongodb://         → protocolo
127.0.0.1          → servidor local
27017              → puerto de MongoDB
proyectoSemestre   → nombre de la base de datos
```

El servidor primero intenta conectarse a MongoDB y posteriormente inicia el servidor HTTP.

---

# 8. `models/user.js`

## Objetivo

Define la estructura de los usuarios y las reglas relacionadas con el almacenamiento de sus datos.

El usuario contiene actualmente:

```text
name
email
password
role
isActive
```

El campo `role` solamente admite:

```text
ADMIN
RECEPCIONISTA
```

Los registros nuevos reciben `RECEPCIONISTA` por defecto. El campo es obligatorio y
Mongoose rechaza cualquier otro valor.

Los usuarios que ya existían se actualizan ejecutando la migración desde `backend/`:

```bash
NODE_ENV=development npm run migrate:roles
```

La migración convierte `admin` a `ADMIN`, `user` a `RECEPCIONISTA` y asigna
`RECEPCIONISTA` a los documentos sin rol. Es idempotente y se puede ejecutar más de
una vez. Para otro entorno, define `NODE_ENV` y configura el archivo `.env` que le
corresponde antes de ejecutarla.

El registro para crear recepcionistas requiere un `ADMIN` y siempre asigna
`RECEPCIONISTA`. La creación y asignación de cuentas `ADMIN` se hará mediante un
flujo administrativo o una operación controlada en MongoDB.

La contraseña tiene:

```javascript
select: false
```

para evitar que aparezca en consultas normales.

## Hash de contraseña

Antes de guardar un usuario, la contraseña se transforma mediante:

```text
bcrypt.hash()
```

Por lo tanto, si el usuario envía:

```text
12345678
```

la base de datos almacena un hash y no la contraseña original.

El código comprueba además si la contraseña realmente cambió antes de volver a aplicar el hash.

## Comparación de contraseñas

Para el login se utiliza:

```text
bcrypt.compare()
```

Esto permite comparar la contraseña enviada por el usuario contra el hash almacenado.

---

# 9. `services/authService.js`

## Objetivo

Contiene la lógica de autenticación.

Actualmente implementa:

```text
login()
logout()
getMe()
generateToken()
```

## Registro

El registro administrativo:

1. Requiere un JWT de `ADMIN`.
2. Comprueba si el correo ya existe.
3. Crea una cuenta activa con rol `RECEPCIONISTA`.
4. Devuelve la cuenta, sin emitir un token para el usuario nuevo.

La ruta antigua `/api/v1/auth/register` se conserva por compatibilidad y también
requiere un JWT de `ADMIN`. El rol siempre se asigna en el servidor.

## Login

El login:

1. Busca el usuario por correo.
2. Recupera temporalmente la contraseña porque normalmente está oculta.
3. Compara la contraseña utilizando bcrypt.
4. Si las credenciales son correctas, genera un JWT.
5. Devuelve el token.

## JWT

El token se genera con `jsonwebtoken`.

Actualmente contiene como identificación principal el campo:

```text
sub
```

que representa el identificador del usuario.

También contiene una versión de sesión (`ver`). Al cerrar sesión, el backend
la incrementa y deja inválidos los JWT emitidos anteriormente para ese usuario.
Por eso el cierre invalida las sesiones abiertas en otros dispositivos también.

El tiempo de expiración se obtiene desde:

```env
JWT_EXPIRES_IN
```

---

# 10. `controllers/authController.js`

## Objetivo

Gestionar la comunicación HTTP relacionada con autenticación.

Actualmente expone operaciones para:

```text
register
login
logout
me
```

El controlador recibe:

```text
Request
```

y genera:

```text
Response
```

La lógica de negocio permanece en `authService.js` y `userService.js`.

Por ejemplo, el controller no genera el hash de una contraseña ni consulta MongoDB directamente.

---

# 11. `routes/authRoutes.js`

## Objetivo

Define los endpoints de autenticación.

Actualmente:

```http
POST /api/v1/auth/register  (solo ADMIN; compatibilidad)
POST /api/v1/auth/login
POST /api/v1/auth/logout
GET  /api/v1/auth/me
```

## Gestión de recepcionistas

Estas rutas requieren `Authorization: Bearer <TOKEN_ADMIN>`:

```http
POST  /api/v1/users
GET   /api/v1/users
PATCH /api/v1/users/:id/status
```

La creación asigna siempre el rol `RECEPCIONISTA` y activa la cuenta. El listado
incluye cuentas activas e inactivas. El cambio de estado recibe un booleano JSON,
por ejemplo `{ "isActive": false }`. Los endpoints solo operan sobre usuarios
`RECEPCIONISTA`; no permiten modificar ni desactivar cuentas `ADMIN`.

## Registro

```http
POST /api/v1/auth/register
```

Esta ruta requiere `Authorization: Bearer <TOKEN_ADMIN>`.

Ejemplo:

```json
{
  "name": "Edwin",
  "email": "edwin@test.com",
  "password": "12345678"
}
```

## Login

```http
POST /api/v1/auth/login
```

Ejemplo:

```json
{
  "email": "edwin@test.com",
  "password": "12345678"
}
```

## Usuario autenticado

```http
GET /api/v1/auth/me
```

Esta ruta requiere:

```http
Authorization: Bearer <TOKEN>
```

## Cierre de sesión

```http
POST /api/v1/auth/logout
```

También requiere `Authorization: Bearer <TOKEN>`. El backend incrementa la
versión de sesión del usuario; el token usado y los demás tokens existentes
dejan de autorizar peticiones. El cliente debe eliminar el token almacenado.

---

# 12. `middlewares/validate.js`

## Objetivo

Centralizar la comprobación de errores producidos por `express-validator`.

La validación ocurre antes de que la petición llegue al controller.

Ejemplo:

```text
POST /register
   │
   ▼
Validación
   │
   ├── datos inválidos → 400
   │
   └── datos correctos
          │
          ▼
       Controller
```

Actualmente se validan datos como:

- nombre obligatorio.
- correo válido.
- contraseña con mínimo de caracteres.

---

# 13. `middlewares/authMiddleware.js`

Este archivo contiene dos conceptos diferentes:

```text
protect
restrictTo
```

## `protect`

Su función es autenticar al usuario.

El cliente debe enviar:

```http
Authorization: Bearer TOKEN
```

El middleware:

1. Obtiene el header.
2. Extrae el token.
3. Verifica el JWT.
4. Obtiene el identificador del usuario.
5. Consulta el usuario en MongoDB.
6. Guarda el usuario actual en:

```javascript
req.user
```

También compara la versión del token con la versión guardada del usuario. Así,
los tokens revocados al cerrar sesión dejan de ser aceptados.

Después llama `next()` para permitir que la petición continúe.

## `restrictTo`

Su objetivo es autorizar según el rol.

Por ejemplo:

```javascript
restrictTo('ADMIN')
```

comprueba:

```javascript
req.user.role
```

Si el usuario no tiene el rol requerido, se responde:

```text
403 Forbidden
```

---

# 14. Autenticación vs autorización

Es importante no confundir ambos conceptos.

## Autenticación

Pregunta:

> ¿Quién eres?

En este proyecto se resuelve mediante:

```text
JWT
```

## Autorización

Pregunta:

> ¿Qué puedes hacer?

En este proyecto se resuelve mediante:

```text
role
```

Por ejemplo:

```text
JWT válido
   │
   ▼
Usuario autenticado
   │
   ▼
role = RECEPCIONISTA
   │
   └── no puede entrar a una ruta exclusiva de ADMIN
```

---

# 15. `routes/adminRoutes.js`

Actualmente se utiliza para demostrar una ruta protegida exclusivamente para administradores.
Las reglas para los demás módulos se añadirán cuando se defina qué operaciones
corresponden a cada rol.

La estructura es:

```text
protect
   ↓
restrictTo('ADMIN')
   ↓
controller
```

Esto significa:

1. Primero se debe tener un JWT válido.
2. Después se verifica el rol.
3. Solo entonces se permite ejecutar la operación.

---

# 16. `middlewares/errorHandler.js`

## Objetivo

Centralizar los errores producidos por la aplicación.

Entre los casos tratados están:

- JWT inválido.
- JWT expirado.
- errores de validación de Mongoose.
- identificadores inválidos.
- registros duplicados.
- errores creados mediante `AppError`.
- errores inesperados del servidor.

Esto permite que los controllers y servicios no tengan que construir manualmente una respuesta de error para cada situación.

---

# 17. `utils/AppError.js`

## Objetivo

Representar errores controlados de la aplicación.

En lugar de depender de mensajes como:

```javascript
if (err.message === 'No autorizado')
```

se puede utilizar:

```javascript
throw new AppError(
    'No tienes permisos',
    403
);
```

El `errorHandler` puede identificar el código HTTP de forma consistente.

---

# 18. `utils/catchAsync.js`

## Objetivo

Capturar errores de funciones asíncronas y enviarlos al `errorHandler`.

Permite mantener los controllers más limpios.

En lugar de repetir:

```javascript
try {
    ...
} catch (error) {
    next(error);
}
```

se puede utilizar:

```javascript
catchAsync(async (req, res) => {
    ...
});
```

---

# 19. `utils/logger.js`

## Objetivo

Centralizar los mensajes de log de la aplicación.

Actualmente permite registrar:

```text
INFO
ERROR
WARN
```

Por ejemplo:

```text
[INFO] MongoDB conectado correctamente
[INFO] Servidor ejecutándose en puerto 3000
```

Esto facilita posteriormente integrar una solución de logging más avanzada.

---

# 20. Seguridad implementada actualmente

La API utiliza varias medidas de seguridad.

## Helmet

Configura cabeceras HTTP de seguridad.

## CORS

Controla desde qué origen puede comunicarse el frontend con la API.

## Rate limiting

Limita las solicitudes para reducir abusos y ataques automatizados.

Existe una limitación general y una más restrictiva para las operaciones relacionadas con autenticación.

## Bcrypt

Las contraseñas no se almacenan en texto plano.

## JWT

Las rutas protegidas requieren un token válido.

## Roles

Las operaciones restringidas requieren el rol adecuado.

## Límite del JSON

El parser JSON está configurado con un límite pequeño para evitar cuerpos excesivamente grandes.

---

# 21. Estado actual del proyecto

Actualmente el backend ya cuenta con una base funcional de autenticación.

### Implementado

```text
[x] Express
[x] Configuración del servidor
[x] Variables de entorno
[x] MongoDB + Mongoose
[x] Modelo User
[x] Registro
[x] Hash de contraseña con bcrypt
[x] Login
[x] Logout con revocación de tokens
[x] Generación JWT
[x] Validación JWT
[x] Middleware protect
[x] Middleware restrictTo
[x] Roles ADMIN/RECEPCIONISTA
[x] Crear y listar recepcionistas (solo ADMIN)
[x] Activar y desactivar recepcionistas (solo ADMIN)
[x] Bloquear login y tokens de cuentas desactivadas
[x] Ruta /me
[x] Validación de entrada
[x] Manejo de errores
[x] Logging
[x] Helmet
[x] CORS
[x] Compression
[x] Rate limiting
[x] Graceful shutdown
```

---

# 22. Qué todavía no está implementado

El proyecto todavía puede crecer en varias direcciones.

## Gestión de usuarios

La gestión de cuentas de recepcionistas ya está implementada en `/api/v1/users`.
Todavía no hay endpoints para consultar uno específico, editar sus datos, eliminar
usuarios ni cambiar roles.

---

# 23. Próximos pasos recomendados

El orden recomendado para continuar es:

## Etapa 1 — Completar autorización por módulo

Definir y aplicar las reglas de acceso de `ADMIN` y `RECEPCIONISTA` para cada módulo
cuando se acuerde la matriz de permisos. El middleware `protect` y `restrictTo` ya
está disponible para proteger esas rutas.

---

## Etapa 2 — Mejorar seguridad

Posibles mejoras:

- recuperación de contraseña.
- cambio de contraseña.
- revocación o invalidación de sesiones.
- políticas de contraseña más fuertes.
- configuración CORS específica para producción.
- protección adicional de endpoints de autenticación.
- configuración segura de secretos.

---

## Etapa 3 — Crear el recurso principal del proyecto

Una vez terminada la autenticación, la API puede comenzar a trabajar sobre las entidades reales del sistema.

El patrón será:

```text
routes
   ↓
middleware
   ↓
controller
   ↓
service
   ↓
model
   ↓
MongoDB
```

Así la autenticación queda separada de la lógica propia del negocio.

---

## Etapa 5 — Pruebas automatizadas

Añadir pruebas para:

### Registro

- registro correcto.
- correo duplicado.
- contraseña inválida.

### Login

- credenciales correctas.
- contraseña incorrecta.
- usuario inexistente.

### JWT

- token correcto.
- token inválido.
- token expirado.
- ausencia del token.

### Roles

- usuario normal intentando entrar a una ruta de admin.
- administrador entrando correctamente.

---

# 24. Pruebas manuales actuales con Postman

## Health Check

```http
GET http://localhost:3000/health
```

## Registro

```http
POST http://localhost:3000/api/v1/users
```

Header: `Authorization: Bearer <TOKEN_ADMIN>`.

Body:

```json
{
  "name": "Edwin",
  "email": "edwin@test.com",
  "password": "12345678"
}
```

## Listar recepcionistas

```http
GET http://localhost:3000/api/v1/users
Authorization: Bearer <TOKEN_ADMIN>
```

## Desactivar o activar una cuenta

```http
PATCH http://localhost:3000/api/v1/users/<USER_ID>/status
Authorization: Bearer <TOKEN_ADMIN>
Content-Type: application/json
```

Body para desactivar: `{ "isActive": false }`. Para reactivar, envía `true`.

## Login

```http
POST http://localhost:3000/api/v1/auth/login
```

Body:

```json
{
  "email": "edwin@test.com",
  "password": "12345678"
}
```

## Usuario autenticado

```http
GET http://localhost:3000/api/v1/auth/me
```

Header:

```http
Authorization: Bearer <TOKEN>
```

## Cierre de sesión

```http
POST http://localhost:3000/api/v1/auth/logout
```

Header:

```http
Authorization: Bearer <TOKEN>
```

## Ruta de administrador

```http
GET http://localhost:3000/api/v1/admin/dashboard
```

Header:

```http
Authorization: Bearer <TOKEN>
```

---

# 25. Flujo completo de autenticación

```text
CREAR RECEPCIONISTA (ADMIN)
   │
   ▼
Validar datos
   │
   ▼
¿Correo existe?
   │
   ├── Sí → 409
   │
   └── No
       │
       ▼
   bcrypt.hash()
       │
       ▼
    MongoDB
       │
       ▼
    cuenta creada


LOGIN
   │
   ▼
Validar datos
   │
   ▼
Buscar usuario
   │
   ▼
bcrypt.compare()
   │
   ├── No → 401
   │
   └── Sí
       │
       ▼
    jwt.sign()
       │
       ▼
     TOKEN


RUTA PROTEGIDA
   │
   ▼
Authorization: Bearer TOKEN
   │
   ▼
jwt.verify()
   │
   ├── inválido → 401
   │
   └── válido
       │
       ▼
    buscar usuario
       │
       ▼
      req.user
       │
       ▼
    controller


RUTA SOLO ADMIN
   │
   ▼
protect
   │
   ▼
restrictTo('ADMIN')
   │
   ├── RECEPCIONISTA → 403
   │
   └── ADMIN
       │
       ▼
    controller
```

---



La base actual puede representarse como:

```text
              API REST
                 │
       ┌─────────┴─────────┐
       │                   │
  Autenticación       Lógica de negocio
       │                   │
       ▼                   ▼
     JWT                Services
       │                   │
       ▼                   ▼
     protect             Models
       │                   │
       ▼                   ▼
     Roles              MongoDB
```
