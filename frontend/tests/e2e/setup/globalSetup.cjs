// Antes de abrir el navegador: valida la configuración, despierta la API de QA
// y confirma que el frontend responde. Así un fallo de entorno se distingue de un fallo de la app.
require('./loadEnv.cjs');

const REQUIRED = [
  'TEST_APP_URL',
  'TEST_API_URL',
  'TEST_ADMIN_EMAIL',
  'TEST_ADMIN_PASSWORD',
  'TEST_RECEPTION_EMAIL',
  'TEST_RECEPTION_PASSWORD',
];

async function reachable(url, timeoutMs) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    return response.ok;
  } catch {
    return false;
  }
}

module.exports = async () => {
  const missing = REQUIRED.filter((name) => !process.env[name]);
  if (missing.length) {
    throw new Error(
      `Faltan variables para las pruebas E2E: ${missing.join(', ')}. ` +
      'Copia frontend/tests/e2e/e2e.env.example como frontend/.env.e2e y complétalo.',
    );
  }

  if (!(await reachable(`${process.env.TEST_API_URL}/health`, 90000))) {
    throw new Error(`La API de pruebas no respondió en ${process.env.TEST_API_URL}/health.`);
  }

  if (!(await reachable(process.env.TEST_APP_URL, 10000))) {
    throw new Error(
      `El frontend no responde en ${process.env.TEST_APP_URL}. ` +
      'Inícialo en otra terminal con: npm run dev:e2e',
    );
  }
};
