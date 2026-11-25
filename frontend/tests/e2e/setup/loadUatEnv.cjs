// Carga únicamente la configuración local UAT (frontend/.env.uat).
const fs = require('node:fs');
const path = require('node:path');

const envFile = path.resolve(__dirname, '../../../.env.uat');

if (fs.existsSync(envFile)) {
  process.loadEnvFile(envFile);
}
