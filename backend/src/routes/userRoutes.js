const express = require('express');
const { body, param } = require('express-validator');

const userController = require('../controllers/userController');
const { protect, restrictTo } = require('../middlewares/authMiddleware');
const validate = require('../middlewares/validate');
const { ROLES } = require('../constants/roles');

const router = express.Router();

const requireObjectBody = (req, res, next) => {
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
        return res.status(400).json({
            status: 'fail',
            message: 'Los datos de la cuenta son inválidos'
        });
    }

    next();
};

router.use(protect, restrictTo(ROLES.ADMIN));

router.get('/', userController.getReceptionists);

router.post(
    '/admin',
    body('name')
        .trim()
        .isLength({ min: 2, max: 100 })
        .withMessage('El nombre debe tener entre 2 y 100 caracteres'),
    body('email')
        .isEmail()
        .withMessage('Correo inválido')
        .normalizeEmail(),
    body('password')
        .isLength({ min: 8 })
        .withMessage('La contraseña debe tener al menos 8 caracteres'),
    validate,
    userController.createAdmin
);

router.post(
    '/',
    body('name')
        .trim()
        .isLength({ min: 2, max: 100 })
        .withMessage('El nombre debe tener entre 2 y 100 caracteres'),
    body('email')
        .isEmail()
        .withMessage('Correo inválido')
        .normalizeEmail(),
    body('password')
        .isLength({ min: 8 })
        .withMessage('La contraseña debe tener al menos 8 caracteres'),
    validate,
    userController.createReceptionist
);

router.patch(
    '/:id/status',
    param('id')
        .isMongoId()
        .withMessage('Identificador inválido'),
    body('isActive')
        .custom(value => typeof value === 'boolean')
        .withMessage('isActive debe ser true o false'),
    validate,
    userController.setReceptionistStatus
);

router.patch(
    '/:id',
    param('id')
        .isMongoId()
        .withMessage('Identificador inválido'),
    requireObjectBody,
    body().custom((_, { req }) => {
        const allowedFields = ['name', 'password', 'isActive'];
        const unexpectedFields = Object.keys(req.body).filter(
            field => !allowedFields.includes(field)
        );

        if (unexpectedFields.length) {
            throw new Error('El correo y los datos del sistema no se pueden editar');
        }

        if (!Object.keys(req.body).length) {
            throw new Error('Indica al menos un dato para actualizar');
        }

        return true;
    }),
    body('name')
        .optional()
        .trim()
        .isLength({ min: 2, max: 100 })
        .withMessage('El nombre debe tener entre 2 y 100 caracteres'),
    body('password')
        .optional()
        .isString()
        .withMessage('La contraseña debe ser texto')
        .isLength({ min: 8 })
        .withMessage('La contraseña debe tener al menos 8 caracteres'),
    body('isActive')
        .optional()
        .custom(value => typeof value === 'boolean')
        .withMessage('isActive debe ser true o false'),
    validate,
    userController.updateReceptionist
);

module.exports = router;
