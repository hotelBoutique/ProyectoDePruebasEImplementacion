// Impide que las pruebas UAT envíen solicitudes a servicios desplegados o a una base compartida.
require('./loadUatEnv.cjs');

const fs = require('node:fs');
const path = require('node:path');
const { validateLocalUatConfig } = require('../support/localUatConfig.cjs');

function readEnvValue(source, key) {
  const line = source.split(/\r?\n/).find((item) => new RegExp(`^\\s*${key}\\s*=`).test(item));
  if (!line) return '';
  return line.slice(line.indexOf('=') + 1).trim().replace(/^("|')(.*)\1$/, '$2');
}

async function requireReachable(url, label) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
  } catch (error) {
    throw new Error(`${label} no responde en la dirección local configurada (${error.message}).`);
  }
}

module.exports = async () => {
  const repositoryRoot = path.resolve(__dirname, '../../../../');
  const backendEnvPath = path.join(repositoryRoot, 'backend', '.env.test');
  if (!fs.existsSync(backendEnvPath)) {
    throw new Error('Falta backend/.env.test. Configúralo con MongoDB local y una base terminada en _test.');
  }

  const backendEnv = fs.readFileSync(backendEnvPath, 'utf8');
  const config = validateLocalUatConfig({
    TEST_API_URL: process.env.TEST_API_URL,
    TEST_APP_URL: process.env.TEST_APP_URL,
    VITE_BACKEND_URL: process.env.VITE_BACKEND_URL,
    MONGODB_URI: readEnvValue(backendEnv, 'MONGODB_URI'),
  });

  await requireReachable(`${config.apiUrl.origin}/health`, 'La API local');
  await requireReachable(config.appUrl.origin, 'El frontend local');
};
