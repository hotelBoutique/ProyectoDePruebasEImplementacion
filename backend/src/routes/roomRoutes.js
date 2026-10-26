const express = require('express');
const { body, param } = require('express-validator');

const roomController = require('../controllers/roomController');
const { protect, restrictTo } = require('../middlewares/authMiddleware');
const validate = require('../middlewares/validate');
const { ROLES } = require('../constants/roles');
const ROOM_TYPES = require('../constants/roomTypes');

const router = express.Router();

const ROOM_STATUSES = [
    'disponible',
    'ocupada',
    'mantenimiento',
    'fuera de servicio',
    'limpieza',
    'desinfeccion'
];
const ROOM_FIELDS = ['number', 'type', 'description', 'capacity', 'price', 'status'];

const requireObjectBody = (req, res, next) => {
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
        return res.status(400).json({
            status: 'fail',
            message: 'Los datos de la habitación son inválidos'
        });
    }

    next();
};

router.use(protect);

router.get('/',
    restrictTo(ROLES.ADMIN, ROLES.RECEPCIONISTA),
    roomController.getRooms
);

router.post(
    '/',
    restrictTo(ROLES.ADMIN),
    body('number')
        .exists()
        .withMessage('El número de habitación es obligatorio')
        .bail()
        .isString()
        .withMessage('El número de habitación debe ser texto')
        .bail()
        .trim()
        .notEmpty()
        .withMessage('El número de habitación es obligatorio')
        .bail()
        .isLength({ max: 20 })
        .withMessage('El número de habitación no puede superar 20 caracteres'),
    body('type')
        .exists()
        .withMessage('El tipo de habitación es obligatorio')
        .bail()
        .isString()
        .withMessage('El tipo de habitación debe ser texto')
        .bail()
        .trim()
        .notEmpty()
        .withMessage('El tipo de habitación es obligatorio')
        .bail()
        .isIn(ROOM_TYPES)
        .withMessage('Selecciona un tipo de habitación válido'),
    body('price')
        .exists()
        .withMessage('El precio es obligatorio')
        .bail()
        .notEmpty()
        .withMessage('El precio es obligatorio')
        .bail()
        .isFloat({ min: 0 })
        .withMessage('El precio debe ser un número mayor o igual a 0')
        .toFloat(),
    body('status')
        .optional()
        .isIn(ROOM_STATUSES)
        .withMessage('El estado no es válido'),
    body('description')
        .optional({ values: 'null' })
        .isString()
        .withMessage('La descripción debe ser texto')
        .isLength({ max: 500 })
        .withMessage('La descripción no puede superar 500 caracteres'),
    body('capacity')
        .optional({ values: 'null' })
        .isInt({ min: 1 })
        .withMessage('La capacidad debe ser un número entero mayor o igual a 1')
        .toInt(),
    validate,
    roomController.createRoom
);

router.patch(
    '/:id',
    restrictTo(ROLES.ADMIN),
    param('id')
        .isMongoId()
        .withMessage('Identificador de habitación inválido'),
    requireObjectBody,
    body().custom((_, { req }) => {
        const fields = Object.keys(req.body);
        const unexpectedFields = fields.filter(field => !ROOM_FIELDS.includes(field));

        if (unexpectedFields.length) {
            throw new Error('La solicitud contiene datos de habitación no editables');
        }

        if (!fields.length) {
            throw new Error('Indica al menos un dato para actualizar');
        }

        return true;
    }),
    body('number')
        .optional()
        .isString()
        .withMessage('El número de habitación debe ser texto')
        .bail()
        .trim()
        .notEmpty()
        .withMessage('El número de habitación es obligatorio')
        .bail()
        .isLength({ max: 20 })
        .withMessage('El número de habitación no puede superar 20 caracteres'),
    body('type')
        .optional()
        .isString()
        .withMessage('El tipo de habitación debe ser texto')
        .bail()
        .trim()
        .notEmpty()
        .withMessage('El tipo de habitación es obligatorio')
        .bail()
        .isIn(ROOM_TYPES)
        .withMessage('Selecciona un tipo de habitación válido'),
    body('description')
        .optional({ values: 'null' })
        .isString()
        .withMessage('La descripción debe ser texto')
        .isLength({ max: 500 })
        .withMessage('La descripción no puede superar 500 caracteres'),
    body('capacity')
        .optional({ values: 'null' })
        .isInt({ min: 1 })
        .withMessage('La capacidad debe ser un número entero mayor o igual a 1')
        .toInt(),
    body('price')
        .optional()
        .notEmpty()
        .withMessage('El precio es obligatorio')
        .bail()
        .isFloat({ min: 0 })
        .withMessage('El precio debe ser un número mayor o igual a 0')
        .toFloat(),
    body('status')
        .optional()
        .isIn(ROOM_STATUSES)
        .withMessage('El estado no es válido'),
    validate,
    roomController.updateRoom
);

module.exports = router;
