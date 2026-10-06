const AppError = require('../utils/AppError');
const logger = require('../utils/logger');

const errorHandler = (err, req, res, next) => {

    logger.error(`${err.name}: ${err.message}`, err.stack);

    if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({
            status: 'fail',
            message: 'Token inválido'
        });
    }

    if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
            status: 'fail',
            message: 'Token expirado'
        });
    }

    if (err.code === 11000) {
        return res.status(409).json({
            status: 'fail',
            message: 'El recurso ya existe'
        });
    }

    if (err.name === 'ValidationError') {

        return res.status(400).json({
            status: 'fail',
            message: 'Datos inválidos',
            details: Object.values(
                err.errors
            ).map(
                error => error.message
            )
        });
    }

    if (err.name === 'CastError') {

        return res.status(400).json({
            status: 'fail',
            message: 'Identificador inválido'
        });
    }

    if (err instanceof AppError) {

        return res.status(
            err.statusCode
        ).json({
            status: err.status,
            message: err.message
        });
    }

    res.status(500).json({
        status: 'error',
        message:
            process.env.NODE_ENV === 'development'
                ? err.message
                : 'Error interno del servidor'
    });
};

module.exports = errorHandler;