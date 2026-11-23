# Reportes de la colección Postman

Evidencia de la ejecución de `Hotel-Boutique-API.postman_collection.json` (78 solicitudes, 447 validaciones).

| Archivo | Contenido |
|---|---|
| `reporte-postman-render.html` | Reporte visual generado con Newman (htmlextra) contra la API de pruebas desplegada en Render (`hotel-boutique-api-pruebas.onrender.com`). Resultado: 78/78 solicitudes y 447/447 validaciones aprobadas. Se abre con cualquier navegador. |
| `reporte-postman-hotel-boutique.json` | Resultados exportados desde el Collection Runner de Postman (Export results). Ejecución del 23/11/2026 a las 3:32 p. m. contra la API local (`localhost:3001`). 447 aprobadas, 0 fallidas. |
| `01-resumen-ejecucion.jpeg` | Resumen de la corrida en Postman: 1 iteración, 447 pruebas, 0 errores, 244 ms de respuesta promedio. |
| `02-pruebas-aprobadas.jpeg` | Pestaña *Passed* con el detalle de las pruebas aprobadas. |
| `03-sin-pruebas-fallidas.jpeg` | Pestaña *Failed* vacía: ninguna prueba falló. |
| `04-historial-ejecuciones.jpeg` | Historial de ejecuciones de la colección en Postman. |

Ambas ejecuciones usaron una base de datos aislada para pruebas (`proyectoSemestre_pruebas`), separada de la base de producción.

Los reportes no incluyen contraseñas ni tokens: en el HTML se ocultaron los cuerpos de login y creación de usuarios, el encabezado `Authorization` y las variables sensibles del entorno.
