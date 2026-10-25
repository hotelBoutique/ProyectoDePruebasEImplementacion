const path = require('path')
const dotenv = require('dotenv')

const nodeEnv = process.env.NODE_ENV

const envPath = path.resolve(
    process.cwd(), `.env.${nodeEnv}`
)

const resultado = dotenv.config({
    path: envPath
})

if (resultado.error) {
    throw new Error(`no se puedo cargar el archivo de entorno: ${envPath}`)
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

module.exports = {
    NODE_ENV: nodeEnv,
    PORT: Number(process.env.PORT),
    MONGODB_URI: process.env.MONGODB_URI,
    JWT_SECRET: process.env.JWT_SECRET,
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '1d',
    CORS_ORIGIN: process.env.CORS_ORIGIN
};
