const AppError = require('../utils/AppError');
const logger = require('../utils/logger');

const errorHandler = (err, req, res, next) => {

    logger.error(`${err.name}: ${err.message}`, err.stack);

    if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({
            success: false,
            message: 'Token inválido'
        });
    }

    if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
            success: false,
            message: 'Token expirado'
        });
    }

    if (err.code === 11000) {
        return res.status(409).json({
            success: false,
            message: 'El recurso ya existe'
        });
    }

    if (err.name === 'ValidationError') {

        return res.status(400).json({
            success: false,
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
            success: false,
            message: 'Identificador inválido'
        });
    }

    if (err instanceof AppError) {

        return res.status(
            err.statusCode
        ).json({
            success: false,
            message: err.message
        });
    }

    if (err.statusCode === 404) {

        return res.status(404).json({
            success: false,
            message: 'Recurso no encontrado'
        });
    }

    res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
    });
};

module.exports = errorHandler;
