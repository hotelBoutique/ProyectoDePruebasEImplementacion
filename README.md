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
    ├── models/
    │   └── user.js
    │
    ├── services/
    │   └── authService.js
    │
    ├── controllers/
    │   └── authController.js
    │
    ├── routes/
    │   ├── authRoutes.js
    │   └── adminRoutes.js
    │
    ├── middlewares/
    │   ├── authMiddleware.js
    │   ├── validate.js
    │   └── errorHandler.js
    │
    └── utils/
        ├── AppError.js
        ├── catchAsync.js
        └── logger.js
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

El `app.js` se encarga de configurar la aplicación, mientras `server.js` se encarga de ponerla en ejecución.

---

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
```

El campo `role` solamente admite:

```text
user
admin
```

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
register()
login()
getMe()
generateToken()
```

## Registro

El registro:

1. Comprueba si el correo ya existe.
2. Crea el usuario.
3. Fuerza el rol inicial a `user`.
4. Genera un JWT.
5. Devuelve usuario y token.

Esto evita que una persona pueda registrarse directamente como `admin` enviando:

```json
{
  "role": "admin"
}
```

desde Postman.

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

La lógica de negocio permanece en `authService.js`.

Por ejemplo, el controller no genera el hash de una contraseña ni consulta MongoDB directamente.

---

# 11. `routes/authRoutes.js`

## Objetivo

Define los endpoints de autenticación.

Actualmente:

```http
POST /api/v1/auth/register
POST /api/v1/auth/login
GET  /api/v1/auth/me
```

## Registro

```http
POST /api/v1/auth/register
```

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

Después llama `next()` para permitir que la petición continúe.

## `restrictTo`

Su objetivo es autorizar según el rol.

Por ejemplo:

```javascript
restrictTo('admin')
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
role = user
   │
   └── no puede entrar a una ruta exclusiva de admin
```

---

# 15. `routes/adminRoutes.js`

Actualmente se utiliza para demostrar una ruta protegida exclusivamente para administradores.

La estructura es:

```text
protect
   ↓
restrictTo('admin')
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
[x] Generación JWT
[x] Validación JWT
[x] Middleware protect
[x] Middleware restrictTo
[x] Roles user/admin
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

Actualmente no existe una API completa para:

- listar usuarios.
- consultar un usuario específico.
- actualizar usuarios.
- desactivar usuarios.
- eliminar usuarios.
- cambiar roles.

Una siguiente funcionalidad lógica sería:

```http
PATCH /api/v1/users/:id/role
```

protegida por:

```text
protect
   ↓
restrictTo('admin')
```

Así solamente un administrador podría promover o degradar usuarios.

---

# 23. Próximos pasos recomendados

El orden recomendado para continuar es:

## Etapa 1 — Completar usuarios

Crear:

```text
users/
├── userController.js
├── userService.js
└── userRoutes.js
```

y agregar operaciones para:

```text
GET /users
GET /users/:id
PATCH /users/:id
PATCH /users/:id/role
DELETE /users/:id
```

Todas deben tener reglas de autorización apropiadas.

---

## Etapa 2 — Completar autorización

Agregar reglas como:

```text
user
   ↓
puede consultar sus propios datos

admin
   ↓
puede administrar usuarios
```

Esto permitirá probar realmente la diferencia entre autenticación y autorización.

---

## Etapa 3 — Mejorar seguridad

Posibles mejoras:

- recuperación de contraseña.
- cambio de contraseña.
- revocación o invalidación de sesiones.
- políticas de contraseña más fuertes.
- configuración CORS específica para producción.
- protección adicional de endpoints de autenticación.
- configuración segura de secretos.

---

## Etapa 4 — Crear el recurso principal del proyecto

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
POST http://localhost:3000/api/v1/auth/register
```

Body:

```json
{
  "name": "Edwin",
  "email": "edwin@test.com",
  "password": "12345678"
}
```

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
REGISTRO
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
    jwt.sign()
       │
       ▼
     TOKEN


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
restrictTo('admin')
   │
   ├── user → 403
   │
   └── admin
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


