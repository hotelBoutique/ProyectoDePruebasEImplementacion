const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

process.env.NODE_ENV = 'test';

const testEnvPath = path.resolve(process.cwd(), '.env.test');
const fileEnv = fs.existsSync(testEnvPath)
    ? dotenv.parse(fs.readFileSync(testEnvPath))
    : {};
const mongoUri = process.env.MONGODB_TEST_URI
    || fileEnv.MONGODB_TEST_URI
    || fileEnv.MONGODB_URI;

if (!mongoUri) {
    throw new Error(
        'Configura MONGODB_TEST_URI o backend/.env.test para ejecutar la integración.'
    );
}

let databaseName;
try {
    databaseName = decodeURIComponent(new URL(mongoUri).pathname.replace(/^\/+/, ''));
} catch (_error) {
    throw new Error('MONGODB_TEST_URI no contiene una URI válida de MongoDB.');
}

if (!databaseName.toLowerCase().endsWith('_test')) {
    throw new Error(
        'La base de integración debe terminar en _test; no se conectó a MongoDB.'
    );
}

process.env.MONGODB_URI = mongoUri;
process.env.JWT_SECRET = 'integration-test-only-secret-with-at-least-32-bytes';
process.env.JWT_EXPIRES_IN = '30m';
