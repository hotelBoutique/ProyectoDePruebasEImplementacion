# Pruebas automatizadas de la API

Esta carpeta contiene una colección Postman v2.1 para recorrer el backend sin modificar el código de la aplicación:

- `Hotel-Boutique-API.postman_collection.json`: 78 solicitudes ordenadas por módulos. Comprueba los 46 endpoints de éxito, además de autenticación, permisos, validaciones, duplicados y recursos inexistentes.
- `Hotel-Boutique-Local.postman_environment.example.json`: plantilla importable con URL, credenciales de prueba, variables de sesión, identificadores y límite de latencia.

## Requisitos

1. Inicia el backend con las variables requeridas por `backend/src/config/env.js`. Por ejemplo, `npm run dev` carga `.env.development` desde el directorio `backend`.
2. Usa una base de datos dedicada a pruebas y una cuenta de administrador ya existente. La colección crea cuentas, habitaciones, productos, reservaciones, consumos y pagos; no hay endpoints para borrarlos.
3. Para completar el ciclo de reservación, check-in, consumo y check-out, MongoDB debe operar como replica set o clúster compatible con transacciones.
4. Importa la colección y el archivo de entorno de ejemplo en Postman. Selecciona el entorno y configura `adminEmail` y `adminPassword` con credenciales de la base de pruebas. Cambia también las tres contraseñas de prueba por valores exclusivos de ese entorno.

## Ejecución

Ejecuta la colección de arriba hacia abajo con una iteración. La primera solicitud crea un identificador único y fechas UTC para esa ejecución. Las solicitudes posteriores guardan tokens e identificadores en el entorno seleccionado; por eso es importante no ejecutarlas fuera de orden.

Cada respuesta debe ser JSON válido y tardar como máximo el valor de `maxResponseMs` (por defecto, 2000 ms). Ajusta ese umbral según la máquina y la latencia esperada del entorno; los reportes y consultas dependen de MongoDB.

También se puede ejecutar con Newman, sin agregar dependencias al `package.json`:

```bash
npx --yes newman run backend/postman/Hotel-Boutique-API.postman_collection.json \
  --environment /ruta/a/tu/Hotel-Boutique-Local.postman_environment.json
```

Para Newman, crea una copia local del archivo de entorno de ejemplo, rellena las credenciales en esa copia y evita guardar secretos o tokens en Git.

## Integración continua

El workflow `.github/workflows/ci.yml` ejecuta la colección con Newman en cada push y pull request a `main`, después de que pasen los tests de Jest. Levanta MongoDB como replica set en el runner, crea el administrador con `npm run seed:admin` (lee `ADMIN_EMAIL` y `ADMIN_PASSWORD`) e inicia la API antes de correr la colección. El reporte JUnit queda como artefacto `newman-resultados` de la ejecución.

## Qué valida

- Códigos HTTP esperados y estructuras de respuesta JSON para cada ruta.
- Tiempo de respuesta frente a `maxResponseMs`.
- Login válido e inválido, token ausente o malformado, acceso denegado por rol, y tokens revocados por cambio de contraseña, desactivación de cuenta o cierre de sesión.
- Validación de filtros, parámetros, identificadores y cuerpos inválidos.
- Flujos con datos relacionados: habitación, producto, reservación, cancelación, check-in, consumo, check-out, pago y comprobante.

El limitador del servidor permite 100 solicitudes por cada 15 minutos y 10 solicitudes de login en ese periodo. La colección evita una prueba de agotamiento del límite para que la ejecución habitual no bloquee solicitudes posteriores.

## Alcance y observaciones

La colección prueba el contrato HTTP de la aplicación en ejecución; las pruebas Jest/Supertest existentes siguen cubriendo lógica de rutas, servicios y modelos con distintos niveles de aislamiento. No se cambió la lógica del negocio ni se añadieron dependencias al backend.

La documentación general enumera cuatro estados de habitación, pero el validador actual también acepta `limpieza` y `desinfeccion`. Esta colección usa los valores que acepta el código vigente (`disponible`, `ocupada`, `mantenimiento`, `fuera de servicio`, `limpieza` y `desinfeccion`).
