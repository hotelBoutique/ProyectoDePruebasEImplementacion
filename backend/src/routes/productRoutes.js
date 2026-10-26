const express = require('express');
const { body, param } = require('express-validator');

const productController = require('../controllers/productController');
const { protect, restrictTo } = require('../middlewares/authMiddleware');
const validate = require('../middlewares/validate');
const { ROLES } = require('../constants/roles');

const router = express.Router();

router.use(protect);

router.get('/',
    restrictTo(ROLES.ADMIN, ROLES.RECEPCIONISTA),
    productController.getProducts
);

router.post(
    '/',
    restrictTo(ROLES.ADMIN),
    body('name')
        .trim()
        .isLength({ min: 2, max: 100 })
        .withMessage('El nombre debe tener entre 2 y 100 caracteres'),
    body('description')
        .optional({ values: 'null' })
        .isString()
        .withMessage('La descripción debe ser texto')
        .isLength({ max: 500 })
        .withMessage('La descripción no puede superar 500 caracteres'),
    body('category')
        .trim()
        .isLength({ min: 1, max: 50 })
        .withMessage('La categoría debe tener entre 1 y 50 caracteres'),
    body('price')
        .isFloat({ min: 0 })
        .withMessage('El precio debe ser un número mayor o igual a 0')
        .toFloat(),
    body('stock')
        .optional({ values: 'null' })
        .isInt({ min: 0 })
        .withMessage('El stock debe ser un número entero mayor o igual a 0')
        .toInt(),
    body('isActive')
        .optional({ values: 'null' })
        .isBoolean()
        .withMessage('isActive debe ser true o false')
        .toBoolean(),
    validate,
    productController.createProduct
);

const PRODUCT_FIELDS = ['name', 'description', 'category', 'price', 'stock', 'isActive'];

router.patch(
    '/:id',
    restrictTo(ROLES.ADMIN),
    param('id')
        .isMongoId()
        .withMessage('Identificador de producto inválido'),
    body().custom((_, { req }) => {
        if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
            throw new Error('Los datos del producto son inválidos');
        }

        const fields = Object.keys(req.body);
        const unexpectedFields = fields.filter(field => !PRODUCT_FIELDS.includes(field));

        if (!fields.length) {
            throw new Error('Indica al menos un dato para actualizar');
        }

        if (unexpectedFields.length) {
            throw new Error('La solicitud contiene datos de producto no editables');
        }

        return true;
    }),
    body('name')
        .optional()
        .trim()
        .isLength({ min: 2, max: 100 })
        .withMessage('El nombre debe tener entre 2 y 100 caracteres'),
    body('description')
        .optional({ values: 'null' })
        .isString()
        .withMessage('La descripción debe ser texto')
        .isLength({ max: 500 })
        .withMessage('La descripción no puede superar 500 caracteres'),
    body('category')
        .optional()
        .trim()
        .isLength({ min: 1, max: 50 })
        .withMessage('La categoría debe tener entre 1 y 50 caracteres'),
    body('price')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('El precio debe ser un número mayor o igual a 0')
        .toFloat(),
    body('stock')
        .optional()
        .isInt({ min: 0 })
        .withMessage('El stock debe ser un número entero mayor o igual a 0')
        .toInt(),
    body('isActive')
        .optional()
        .isBoolean()
        .withMessage('isActive debe ser true o false')
        .toBoolean(),
    validate,
    productController.updateProduct
);

module.exports = router;
