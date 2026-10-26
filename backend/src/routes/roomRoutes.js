const express = require('express');
const { body, param, query } = require('express-validator');

const roomController = require('../controllers/roomController');
const { protect, restrictTo } = require('../middlewares/authMiddleware');
const validate = require('../middlewares/validate');
const { ROLES } = require('../constants/roles');

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

const singleValue = value => typeof value === 'string';

router.get('/',
    restrictTo(ROLES.ADMIN, ROLES.RECEPCIONISTA),
    query(['status', 'type', 'minCapacity', 'minPrice', 'maxPrice'])
        .optional()
        .custom(singleValue)
        .withMessage('Cada filtro admite un solo valor'),
    query('status')
        .optional({ checkFalsy: true })
        .isIn(ROOM_STATUSES)
        .withMessage('El estado no es válido'),
    query('type')
        .optional({ checkFalsy: true })
        .isLength({ max: 50 })
        .withMessage('El tipo de habitación no puede superar 50 caracteres'),
    query('minCapacity')
        .optional({ checkFalsy: true })
        .isInt({ min: 1 })
        .withMessage('La capacidad mínima debe ser un número entero mayor o igual a 1'),
    query('minPrice')
        .optional({ checkFalsy: true })
        .isFloat({ min: 0 })
        .withMessage('El precio mínimo debe ser un número mayor o igual a 0'),
    query('maxPrice')
        .optional({ checkFalsy: true })
        .isFloat({ min: 0 })
        .withMessage('El precio máximo debe ser un número mayor o igual a 0')
        .bail()
        .custom((maxPrice, { req }) => !req.query.minPrice || Number(maxPrice) >= Number(req.query.minPrice))
        .withMessage('El precio máximo debe ser mayor o igual al precio mínimo'),
    validate,
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
        .isLength({ max: 50 })
        .withMessage('El tipo de habitación no puede superar 50 caracteres'),
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
        .isLength({ max: 50 })
        .withMessage('El tipo de habitación no puede superar 50 caracteres'),
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
