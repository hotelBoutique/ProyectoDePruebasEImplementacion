// Carga frontend/.env.e2e (si existe) sin agregar dependencias: usa process.loadEnvFile de Node.
// Las variables definidas en la terminal tienen prioridad sobre las del archivo.
const fs = require('fs');
const path = require('path');

const envFile = path.resolve(__dirname, '../../../.env.e2e');

if (fs.existsSync(envFile)) {
  process.loadEnvFile(envFile);
}
