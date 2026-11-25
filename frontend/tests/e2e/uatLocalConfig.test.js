import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { assertLocalHttpUrl, assertLocalMongoUri, validateLocalUatConfig } = require('./support/localUatConfig.cjs');

test('permite direcciones HTTP de loopback para el frontend y la API', () => {
  assert.equal(assertLocalHttpUrl('http://127.0.0.1:3000', 'API').hostname, '127.0.0.1');
  assert.equal(assertLocalHttpUrl('http://localhost:5174', 'Frontend').hostname, 'localhost');
});

test('rechaza direcciones de servicios remotos', () => {
  assert.throws(() => assertLocalHttpUrl('https://hotel.example.com', 'API'), /debe usar HTTP y apuntar a/);
  assert.throws(() => assertLocalHttpUrl('http://192.168.1.10:3000', 'API'), /debe usar HTTP y apuntar a/);
});

test('acepta solo MongoDB local con base terminada en _test', () => {
  assert.equal(
    assertLocalMongoUri('mongodb://127.0.0.1:27017/hotel_uat_test?replicaSet=rs0').databaseName,
    'hotel_uat_test',
  );
  assert.throws(() => assertLocalMongoUri('mongodb://127.0.0.1:27017/hotel_uat'), /terminar en _test/);
  assert.throws(() => assertLocalMongoUri('mongodb://127.0.0.1:27017/hotel_uat_test'), /replica set/);
  assert.throws(() => assertLocalMongoUri('mongodb+srv://cluster.example.com/hotel_uat_test'), /MongoDB en localhost/);
});

test('valida todas las URLs y la base antes de habilitar UAT local', () => {
  assert.doesNotThrow(() => validateLocalUatConfig({
    TEST_API_URL: 'http://127.0.0.1:3000',
    TEST_APP_URL: 'http://127.0.0.1:5174',
    VITE_BACKEND_URL: 'http://127.0.0.1:3000',
    MONGODB_URI: 'mongodb://localhost:27017/hotel_uat_test?replicaSet=rs0',
  }));
});

test('exige que el proxy del frontend y la API directa apunten al mismo backend local', () => {
  assert.throws(() => validateLocalUatConfig({
    TEST_API_URL: 'http://127.0.0.1:3000',
    TEST_APP_URL: 'http://127.0.0.1:5174',
    VITE_BACKEND_URL: 'http://localhost:3001',
    MONGODB_URI: 'mongodb://localhost:27017/hotel_uat_test?replicaSet=rs0',
  }), /deben apuntar al mismo backend local/);
});
