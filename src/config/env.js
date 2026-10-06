const path = require('path')
const dotenv = require('dotenv')
const { error } = require('console')

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

const requiereVariables = [
    'MONGODB_URI', 'JWT_SECRET'
]

for (const varable of requiereVariables){
    if (!process.env[varable]){
        throw new Error(`falta la variable de entorno ${varable}`)
    }
}

module.exports = {
    NODE_ENV: nodeEnv,
    PORT: Number(process.env.PORT),
    MONGODB_URI: process.env.MONGODB_URI,
    JWT_SECRET: process.env.JWT_SECRET,
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN,
    CORS_ORIGIN: process.env.CORS_ORIGIN
};