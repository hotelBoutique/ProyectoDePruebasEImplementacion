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

El comando principal ejecuta todas las pruebas Jest detectadas por el proyecto:

```bash
cd backend
npm test -- --runInBand
```

Resultado actual:

- 20 suites.
- 210 pruebas aprobadas.
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

Estado: pendiente.

Actualmente no existe una suite que conecte Mongoose a MongoDB Atlas durante Jest y ejecute el flujo completo:

```text
request HTTP → middleware real → controlador → servicio real → modelo real → MongoDB
```

Por ese motivo, la integración real contra la base de datos se considera aproximadamente **0% implementada**, aunque la conexión de la aplicación a Atlas sí fue verificada fuera de Jest.

No se deben ejecutar pruebas destructivas contra la base `proyectoSemestre`. Para implementar esta fase se necesitaría un entorno o base de datos de pruebas aislado, con limpieza controlada de los documentos creados.

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
| Integración con Mongoose/MongoDB real | Pendiente | 0% en Jest |
| Flujos Big Bang completos | Pendiente | 0% implementado |

## Recomendación para la siguiente fase

1. Mantener las unitarias aisladas con mocks.
2. Crear un entorno de pruebas de MongoDB separado del desarrollo.
3. Añadir una configuración Jest exclusiva para integración.
4. Conectar Mongoose antes de la suite y cerrar la conexión después.
5. Crear y limpiar únicamente datos identificados por cada prueba.
6. Añadir flujos completos de usuarios, reservas, check-in, check-out y pagos.

No se deben incluir credenciales reales en este README ni en archivos versionados.
