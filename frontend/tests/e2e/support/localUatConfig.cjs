const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

function isLoopback(hostname) {
  return LOCAL_HOSTS.has(String(hostname).replace(/^\[|\]$/g, '').toLowerCase());
}

function assertLocalHttpUrl(value, name) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} debe ser una URL HTTP local válida.`);
  }

  if (url.protocol !== 'http:' || !isLoopback(url.hostname)) {
    throw new Error(`${name} debe usar HTTP y apuntar a localhost, 127.0.0.1 o ::1.`);
  }
  return url;
}

function assertLocalMongoUri(value) {
  let uri;
  try {
    uri = new URL(value);
  } catch {
    throw new Error('MONGODB_URI debe ser una URI MongoDB local válida.');
  }

  if (uri.protocol !== 'mongodb:' || !isLoopback(uri.hostname)) {
    throw new Error('MONGODB_URI debe conectarse a MongoDB en localhost, 127.0.0.1 o ::1.');
  }

  const databaseName = decodeURIComponent(uri.pathname.replace(/^\/+/, ''));
  if (!databaseName.toLowerCase().endsWith('_test')) {
    throw new Error('La base UAT local debe terminar en _test.');
  }
  if (!uri.searchParams.get('replicaSet')) {
    throw new Error('MongoDB UAT local debe configurarse como replica set para las transacciones de reservación.');
  }
  return { uri, databaseName };
}

function validateLocalUatConfig({ TEST_API_URL, TEST_APP_URL, VITE_BACKEND_URL, MONGODB_URI }) {
  const apiUrl = assertLocalHttpUrl(TEST_API_URL, 'TEST_API_URL');
  const appUrl = assertLocalHttpUrl(TEST_APP_URL, 'TEST_APP_URL');
  const backendUrl = assertLocalHttpUrl(VITE_BACKEND_URL, 'VITE_BACKEND_URL');
  if (apiUrl.origin !== backendUrl.origin) {
    throw new Error('TEST_API_URL y VITE_BACKEND_URL deben apuntar al mismo backend local.');
  }
  const mongo = assertLocalMongoUri(MONGODB_URI);
  return { apiUrl, appUrl, backendUrl, mongo };
}

module.exports = {
  assertLocalHttpUrl,
  assertLocalMongoUri,
  validateLocalUatConfig,
};
