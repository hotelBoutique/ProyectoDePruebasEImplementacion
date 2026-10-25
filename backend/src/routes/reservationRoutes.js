const express = require('express');
const { body, query } = require('express-validator');

const reservationController = require('../controllers/reservationController');
const { protect, restrictTo } = require('../middlewares/authMiddleware');
const validate = require('../middlewares/validate');
const { ROLES } = require('../constants/roles');

const router = express.Router();
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const isRealDate = value => {
    if (!ISO_DATE_PATTERN.test(value)) return false;

    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

router.use(protect);

router.get(
    '/availability',
    restrictTo(ROLES.ADMIN, ROLES.RECEPCIONISTA),
    query('checkIn')
        .custom(isRealDate)
        .withMessage('El check-in debe ser una fecha válida con formato AAAA-MM-DD'),
    query('checkOut')
        .custom(isRealDate)
        .withMessage('El check-out debe ser una fecha válida con formato AAAA-MM-DD'),
    query('checkOut')
        .custom((checkOut, { req }) => checkOut > req.query.checkIn)
        .withMessage('El check-out debe ser posterior al check-in'),
    validate,
    reservationController.getAvailableRooms
);

router.post(
    '/',
    restrictTo(ROLES.RECEPCIONISTA),
    body('guest')
        .isObject()
        .withMessage('Los datos del huésped son obligatorios'),
    body('guest.fullName')
        .exists()
        .withMessage('El nombre completo del huésped es obligatorio')
        .bail()
        .trim()
        .isLength({ min: 2, max: 100 })
        .withMessage('El nombre completo del huésped debe tener entre 2 y 100 caracteres'),
    body('guest.email')
        .exists()
        .withMessage('El correo del huésped es obligatorio')
        .bail()
        .isEmail()
        .withMessage('Ingresa un correo válido para el huésped')
        .normalizeEmail(),
    body('guest.phone')
        .exists()
        .withMessage('El teléfono del huésped es obligatorio')
        .bail()
        .isString()
        .withMessage('El teléfono del huésped es obligatorio')
        .bail()
        .trim()
        .isLength({ min: 7, max: 25 })
        .withMessage('El teléfono del huésped debe tener entre 7 y 25 caracteres'),
    body('guest.identification')
        .exists()
        .withMessage('La identificación del huésped es obligatoria')
        .bail()
        .isString()
        .withMessage('La identificación del huésped es obligatoria')
        .bail()
        .trim()
        .isLength({ min: 4, max: 30 })
        .withMessage('La identificación debe tener entre 4 y 30 caracteres'),
    body('roomId')
        .exists()
        .withMessage('La habitación es obligatoria')
        .bail()
        .isMongoId()
        .withMessage('Selecciona una habitación válida'),
    body('checkIn')
        .exists()
        .withMessage('La fecha de check-in es obligatoria')
        .bail()
        .custom(isRealDate)
        .withMessage('El check-in debe ser una fecha válida con formato AAAA-MM-DD'),
    body('checkOut')
        .exists()
        .withMessage('La fecha de check-out es obligatoria')
        .bail()
        .custom(isRealDate)
        .withMessage('El check-out debe ser una fecha válida con formato AAAA-MM-DD')
        .bail()
        .custom((checkOut, { req }) => checkOut > req.body.checkIn)
        .withMessage('El check-out debe ser posterior al check-in'),
    body('nightlyRate')
        .exists()
        .withMessage('La tarifa aplicada es obligatoria')
        .bail()
        .isFloat({ min: 0 })
        .withMessage('La tarifa aplicada debe ser un número mayor o igual a 0')
        .toFloat(),
    validate,
    reservationController.createReservation
);

module.exports = router;
