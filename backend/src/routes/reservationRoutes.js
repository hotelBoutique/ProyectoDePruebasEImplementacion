const express = require('express');
const { body, query } = require('express-validator');

const reservationController = require('../controllers/reservationController');
const { protect, restrictTo } = require('../middlewares/authMiddleware');
const validate = require('../middlewares/validate');
const { ROLES } = require('../constants/roles');
const { isValidDateOnly } = require('../utils/reservationDates');

const router = express.Router();
const validateDate = (value, fieldName) => {
    if (!isValidDateOnly(value)) {
        throw new Error(`${fieldName} debe ser una fecha válida con formato AAAA-MM-DD`);
    }

    return true;
};

router.use(protect);

router.get(
    '/availability',
    restrictTo(ROLES.ADMIN, ROLES.RECEPCIONISTA),
    query('checkIn')
        .notEmpty()
        .withMessage('El check-in es obligatorio')
        .bail()
        .custom(value => validateDate(value, 'El check-in')),
    query('checkOut')
        .notEmpty()
        .withMessage('El check-out es obligatorio')
        .bail()
        .custom(value => validateDate(value, 'El check-out')),
    query('roomId')
        .optional()
        .isMongoId()
        .withMessage('La habitación seleccionada no es válida'),
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
        .withMessage('El nombre completo debe tener entre 2 y 100 caracteres'),
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
        .withMessage('El teléfono del huésped debe ser texto')
        .bail()
        .trim()
        .isLength({ min: 7, max: 25 })
        .withMessage('El teléfono debe tener entre 7 y 25 caracteres'),
    body('guest.identification')
        .exists()
        .withMessage('La identificación del huésped es obligatoria')
        .bail()
        .isString()
        .withMessage('La identificación debe ser texto')
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
        .notEmpty()
        .withMessage('El check-in es obligatorio')
        .bail()
        .custom(value => validateDate(value, 'El check-in')),
    body('checkOut')
        .notEmpty()
        .withMessage('El check-out es obligatorio')
        .bail()
        .custom(value => validateDate(value, 'El check-out')),
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
