const jwt = require('jsonwebtoken');

const User = require('../models/user');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');

const config = require('../config/env');

const protect = catchAsync(
    async (req, res, next) => {

        const authHeader =
            req.headers.authorization;

        if (
            !authHeader ||
            !authHeader.startsWith('Bearer ')
        ) {
            throw new AppError(
                'Token de autenticación requerido',
                401
            );
        }

        const token =
            authHeader.split(' ')[1];

        const decoded =
            jwt.verify(
                token,
                config.JWT_SECRET
            );

        const user =
            await User.findById(
                decoded.sub
            );

        if (!user) {
            throw new AppError(
                'El usuario ya no existe',
                401
            );
        }

        req.user = user;

        next();
    }
);

const restrictTo = (...roles) => {

    return (req, res, next) => {

        if (!req.user) {
            return next(
                new AppError(
                    'Usuario no autenticado',
                    401
                )
            );
        }

        if (!roles.includes(req.user.role)) {
            return next(
                new AppError(
                    'No tienes permisos para esta acción',
                    403
                )
            );
        }

        next();
    };
};

module.exports = {
    protect,
    restrictTo
};