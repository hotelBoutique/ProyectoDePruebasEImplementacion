const express = require('express');
const { body, param, query } = require('express-validator');

const reservationController = require('../controllers/reservationController');
const { protect, restrictTo } = require('../middlewares/authMiddleware');
const validate = require('../middlewares/validate');
const { ROLES } = require('../constants/roles');
const ROOM_TYPES = require('../constants/roomTypes');
const { isValidDateOnly } = require('../utils/reservationDates');

const router = express.Router();
const RESERVATION_STATUSES = ['reservada', 'ocupada', 'cancelada', 'finalizada'];
const validateDate = (value, fieldName) => {
    if (!isValidDateOnly(value)) {
        throw new Error(`${fieldName} debe ser una fecha válida con formato AAAA-MM-DD`);
    }

    return true;
};

router.use(protect);

router.get(
    '/',
    restrictTo(ROLES.ADMIN, ROLES.RECEPCIONISTA),
    query('checkInFrom')
        .optional({ checkFalsy: true })
        .custom(value => validateDate(value, 'La fecha inicial')),
    query('checkInTo')
        .optional({ checkFalsy: true })
        .custom(value => validateDate(value, 'La fecha final')),
    query('checkInTo')
        .optional({ checkFalsy: true })
        .custom((checkInTo, { req }) => !req.query.checkInFrom || checkInTo >= req.query.checkInFrom)
        .withMessage('La fecha final debe ser igual o posterior a la fecha inicial'),
    query('roomId')
        .optional({ checkFalsy: true })
        .isMongoId()
        .withMessage('El identificador de habitación no es válido'),
    query('roomType')
        .optional({ checkFalsy: true })
        .isIn(ROOM_TYPES)
        .withMessage('El tipo de habitación no es válido'),
    query('status')
        .optional({ checkFalsy: true })
        .isIn(RESERVATION_STATUSES)
        .withMessage('El estado de la reservación no es válido'),
    validate,
    reservationController.getReservations
);

router.get(
    '/settlements/history',
    restrictTo(ROLES.ADMIN),
    reservationController.getSettlementHistory
);

const paymentSearchValidators = [
    query('q')
        .optional({ checkFalsy: true })
        .isString()
        .withMessage('La búsqueda debe ser texto')
        .bail()
        .trim()
        .isLength({ max: 100 })
        .withMessage('La búsqueda no puede superar 100 caracteres'),
    query('startDate')
        .optional({ checkFalsy: true })
        .custom(value => validateDate(value, 'La fecha inicial')),
    query('endDate')
        .optional({ checkFalsy: true })
        .custom(value => validateDate(value, 'La fecha final')),
    query('endDate')
        .optional({ checkFalsy: true })
        .custom((endDate, { req }) => !req.query.startDate || endDate >= req.query.startDate)
        .withMessage('La fecha final debe ser igual o posterior a la fecha inicial'),
    query('paymentMethod')
        .optional({ checkFalsy: true })
        .isIn(['efectivo', 'tarjeta', 'transferencia'])
        .withMessage('El método de pago no es válido'),
    query('status')
        .optional({ checkFalsy: true })
        .isIn(['pagada'])
        .withMessage('El estado del pago no es válido'),
    query('page')
        .optional()
        .isInt({ min: 1 })
        .withMessage('La página debe ser un entero mayor o igual a 1')
        .toInt(),
    query('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('El límite debe ser un entero entre 1 y 100')
        .toInt(),
    validate
];

router.get(
    '/payments',
    restrictTo(ROLES.ADMIN),
    paymentSearchValidators,
    reservationController.getPayments
);

// Recepción busca comprobantes sobre los mismos pagos que el administrador consulta en "Pagos realizados".
router.get(
    '/receipts',
    restrictTo(ROLES.ADMIN, ROLES.RECEPCIONISTA),
    paymentSearchValidators,
    reservationController.getPayments
);

router.get(
    '/:id/receipt',
    restrictTo(ROLES.ADMIN, ROLES.RECEPCIONISTA),
    param('id')
        .isMongoId()
        .withMessage('El identificador de la reservación no es válido'),
    validate,
    reservationController.getReceipt
);

router.get(
    '/payments/:id',
    restrictTo(ROLES.ADMIN),
    param('id')
        .isMongoId()
        .withMessage('El identificador del pago no es válido'),
    validate,
    reservationController.getPaymentById
);

router.get(
    '/check-ins/pending',
    restrictTo(ROLES.RECEPCIONISTA),
    reservationController.getPendingCheckIns
);

router.get(
    '/check-outs/pending',
    restrictTo(ROLES.RECEPCIONISTA),
    reservationController.getPendingCheckOuts
);

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
    query(['type', 'guests', 'maxPrice'])
        .optional()
        .custom(value => typeof value === 'string')
        .withMessage('Cada filtro admite un solo valor'),
    query('type')
        .optional({ checkFalsy: true })
        .isIn(ROOM_TYPES)
        .withMessage('El tipo de habitación no es válido'),
    query('guests')
        .optional({ checkFalsy: true })
        .isInt({ min: 1 })
        .withMessage('El número de huéspedes debe ser un entero mayor o igual a 1'),
    query('maxPrice')
        .optional({ checkFalsy: true })
        .isFloat({ min: 0 })
        .withMessage('El precio máximo debe ser un número mayor o igual a 0'),
    validate,
    reservationController.getAvailableRooms
);

router.get(
    '/:id',
    restrictTo(ROLES.ADMIN, ROLES.RECEPCIONISTA),
    param('id')
        .isMongoId()
        .withMessage('Identificador de reservación inválido'),
    validate,
    reservationController.getReservationById
);

router.patch(
    '/:id',
    restrictTo(ROLES.RECEPCIONISTA),
    param('id')
        .isMongoId()
        .withMessage('Identificador de reservación inválido'),
    body().custom((_, { req }) => {
        if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
            throw new Error('Los datos de la reservación son inválidos');
        }

        const allowedFields = ['guest', 'roomId', 'checkIn', 'checkOut', 'nightlyRate'];
        const fields = Object.keys(req.body);
        const unexpectedFields = fields.filter(field => !allowedFields.includes(field));

        if (!fields.length) {
            throw new Error('Indica al menos un dato para actualizar');
        }
        if (unexpectedFields.length) {
            throw new Error('La solicitud contiene datos de reservación no editables');
        }
        return true;
    }),
    body('guest')
        .optional()
        .isObject()
        .withMessage('Los datos del huésped deben ser un objeto'),
    body('guest.fullName')
        .optional()
        .trim()
        .isLength({ min: 2, max: 100 })
        .withMessage('El nombre completo debe tener entre 2 y 100 caracteres'),
    body('guest.email')
        .optional()
        .isEmail()
        .withMessage('Ingresa un correo válido para el huésped')
        .normalizeEmail(),
    body('guest.phone')
        .optional()
        .isString()
        .trim()
        .isLength({ min: 7, max: 25 })
        .withMessage('El teléfono debe tener entre 7 y 25 caracteres'),
    body('guest.identification')
        .optional()
        .isString()
        .trim()
        .isLength({ min: 4, max: 30 })
        .withMessage('La identificación debe tener entre 4 y 30 caracteres'),
    body('roomId')
        .optional()
        .isMongoId()
        .withMessage('Selecciona una habitación válida'),
    body('checkIn')
        .optional()
        .custom(value => validateDate(value, 'El check-in')),
    body('checkOut')
        .optional()
        .custom(value => validateDate(value, 'El check-out')),
    body('nightlyRate')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('La tarifa aplicada debe ser un número mayor o igual a 0')
        .toFloat(),
    validate,
    reservationController.updateReservation
);

router.post(
    '/:id/cancel',
    restrictTo(ROLES.ADMIN, ROLES.RECEPCIONISTA),
    param('id')
        .isMongoId()
        .withMessage('El identificador de la reservación no es válido'),
    body('reason')
        .isString()
        .withMessage('El motivo de cancelación es obligatorio')
        .bail()
        .trim()
        .isLength({ min: 3, max: 500 })
        .withMessage('El motivo de cancelación debe tener entre 3 y 500 caracteres'),
    validate,
    reservationController.cancelReservation
);

router.post(
    '/:id/check-in',
    restrictTo(ROLES.RECEPCIONISTA),
    param('id')
        .isMongoId()
        .withMessage('El identificador de la reservación no es válido'),
    validate,
    reservationController.checkInReservation
);

router.post(
    '/:id/check-out',
    restrictTo(ROLES.RECEPCIONISTA),
    param('id')
        .isMongoId()
        .withMessage('El identificador de la reservación no es válido'),
    body('paidAmount')
        .exists()
        .withMessage('El importe pagado es obligatorio')
        .bail()
        .isFloat({ min: 0 })
        .withMessage('El importe pagado debe ser un número mayor o igual a 0')
        .toFloat(),
    body('paymentMethod')
        .isIn(['efectivo', 'tarjeta', 'transferencia'])
        .withMessage('Selecciona un método de pago válido'),
    body('additionalCharges')
        .optional()
        .isArray({ max: 20 })
        .withMessage('Los cargos adicionales deben ser una lista de máximo 20 conceptos'),
    body('additionalCharges.*.description')
        .if(body('additionalCharges').exists())
        .isString()
        .withMessage('El concepto del cargo debe ser texto')
        .bail()
        .trim()
        .isLength({ min: 2, max: 120 })
        .withMessage('El concepto del cargo debe tener entre 2 y 120 caracteres'),
    body('additionalCharges.*.quantity')
        .optional()
        .isInt({ min: 1, max: 1000 })
        .withMessage('La cantidad del cargo debe ser un entero entre 1 y 1000')
        .toInt(),
    body('additionalCharges.*.unitPrice')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('El precio unitario del cargo debe ser un número mayor o igual a 0')
        .toFloat(),
    body('additionalCharges.*.amount')
        .if(body('additionalCharges').exists())
        .optional()
        .isFloat({ min: 0 })
        .withMessage('El subtotal del cargo debe ser un número mayor o igual a 0')
        .toFloat(),
    validate,
    reservationController.checkOutReservation
);

router.get(
    '/:id/consumptions',
    restrictTo(ROLES.RECEPCIONISTA),
    param('id')
        .isMongoId()
        .withMessage('El identificador de la reservación no es válido'),
    validate,
    reservationController.getReservationConsumptions
);

router.patch(
    '/:id/consumptions/:consumptionId',
    restrictTo(ROLES.RECEPCIONISTA),
    param('id')
        .isMongoId()
        .withMessage('El identificador de la reservación no es válido'),
    param('consumptionId')
        .isMongoId()
        .withMessage('El identificador del consumo no es válido'),
    body().custom((_, { req }) => {
        if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
            throw new Error('Los datos del consumo son inválidos');
        }
        const allowed = ['description', 'quantity', 'unitPrice'];
        const fields = Object.keys(req.body);
        if (!fields.length) throw new Error('Indica al menos un dato para corregir');
        if (fields.some(field => !allowed.includes(field))) {
            throw new Error('La solicitud contiene datos de consumo no editables');
        }
        return true;
    }),
    body('description').optional().trim().isLength({ min: 2, max: 120 }),
    body('quantity').optional().isInt({ min: 1, max: 1000 }).toInt(),
    body('unitPrice').optional().isFloat({ min: 0 }).toFloat(),
    validate,
    reservationController.updateReservationConsumption
);

router.post(
    '/:id/consumptions/:consumptionId/void',
    restrictTo(ROLES.RECEPCIONISTA),
    param('id')
        .isMongoId()
        .withMessage('El identificador de la reservación no es válido'),
    param('consumptionId')
        .isMongoId()
        .withMessage('El identificador del consumo no es válido'),
    body('reason')
        .isString()
        .withMessage('El motivo de anulación es obligatorio')
        .bail()
        .trim()
        .isLength({ min: 3, max: 500 })
        .withMessage('El motivo de anulación debe tener entre 3 y 500 caracteres'),
    validate,
    reservationController.voidReservationConsumption
);

router.post(
    '/:id/consumptions',
    restrictTo(ROLES.RECEPCIONISTA),
    param('id')
        .isMongoId()
        .withMessage('El identificador de la reservación no es válido'),
    body('productId')
        .optional()
        .isMongoId()
        .withMessage('El producto seleccionado no es válido'),
    body('description')
        .if(body('productId').not().exists())
        .isString()
        .withMessage('El concepto del consumo es obligatorio')
        .bail()
        .trim()
        .isLength({ min: 2, max: 120 })
        .withMessage('El concepto del consumo debe tener entre 2 y 120 caracteres'),
    body('quantity')
        .isInt({ min: 1, max: 1000 })
        .withMessage('La cantidad debe ser un entero entre 1 y 1000')
        .toInt(),
    body('unitPrice')
        .if(body('productId').not().exists())
        .isFloat({ min: 0 })
        .withMessage('El precio unitario debe ser un número mayor o igual a 0')
        .toFloat(),
    validate,
    reservationController.addReservationConsumption
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
