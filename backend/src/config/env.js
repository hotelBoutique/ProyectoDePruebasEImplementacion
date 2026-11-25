const fs = require('fs')
const path = require('path')
const dotenv = require('dotenv')

const nodeEnv = process.env.NODE_ENV

const envPath = path.resolve(
    process.cwd(), `.env.${nodeEnv}`
)

// En local se lee .env.<NODE_ENV>. En plataformas como Render no existe ese
// archivo: las variables llegan por process.env y se validan más abajo.
if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath })
}

const requiereVariables = ['MONGODB_URI', 'JWT_SECRET']

for (const varable of requiereVariables){
    if (!process.env[varable]){
        throw new Error(`falta la variable de entorno ${varable}`)
    }
}

if (Buffer.byteLength(process.env.JWT_SECRET, 'utf8') < 32) {
    throw new Error('JWT_SECRET debe tener al menos 32 bytes')
}

const authLoginRateLimitMax = Number(process.env.AUTH_LOGIN_RATE_LIMIT_MAX || 10)

if (!Number.isInteger(authLoginRateLimitMax) || authLoginRateLimitMax < 1) {
    throw new Error('AUTH_LOGIN_RATE_LIMIT_MAX debe ser un entero positivo')
}

module.exports = {
    NODE_ENV: nodeEnv,
    PORT: Number(process.env.PORT),
    MONGODB_URI: process.env.MONGODB_URI,
    JWT_SECRET: process.env.JWT_SECRET,
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '1d',
    CORS_ORIGIN: process.env.CORS_ORIGIN,
    AUTH_LOGIN_RATE_LIMIT_MAX: authLoginRateLimitMax
};
