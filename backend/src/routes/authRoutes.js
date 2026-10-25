const express = require('express');
const { body } = require('express-validator');

const authController = require('../controllers/authController');
const validate = require('../middlewares/validate');

const { protect, restrictTo } = require('../middlewares/authMiddleware');
const { ROLES } = require('../constants/roles');

const router = express.Router();

const requireObjectBody = (req, res, next) => {
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
        return res.status(400).json({
            status: 'fail',
            message: 'Los datos del perfil son inválidos'
        });
    }

    next();
};

router.post('/register',
    protect,
    restrictTo(ROLES.ADMIN),

    body('name')
        .trim()
        .notEmpty()
        .withMessage('El nombre es obligatorio'),

    body('email')
        .isEmail()
        .withMessage('Correo inválido')
        .normalizeEmail(),

    body('password')
        .isLength({ min: 8 })
        .withMessage(
            'La contraseña debe tener al menos 8 caracteres'
        ),

    validate,

    authController.register
);

router.post('/login',

    body('email')
        .isEmail()
        .withMessage('Correo inválido')
        .normalizeEmail(),

    body('password')
        .notEmpty()
        .withMessage(
            'La contraseña es obligatoria'
        ),

    validate,

    authController.login
);

router.post('/logout',
    protect,
    authController.logout
);

router.get('/me',
    protect,
    authController.me
);

router.patch('/me',
    protect,
    requireObjectBody,
    body().custom((_, { req }) => {
        const allowedFields = ['name', 'currentPassword', 'newPassword'];
        const unexpectedFields = Object.keys(req.body).filter(
            field => !allowedFields.includes(field)
        );

        if (unexpectedFields.length) {
            throw new Error('Solo puedes actualizar tu nombre y contraseña');
        }

        if (!req.body.name && !req.body.newPassword) {
            throw new Error('Indica un nombre o una nueva contraseña para actualizar');
        }

        if (Boolean(req.body.currentPassword) !== Boolean(req.body.newPassword)) {
            throw new Error('Para cambiar la contraseña debes indicar la contraseña actual y la nueva');
        }

        return true;
    }),
    body('name')
        .optional()
        .trim()
        .isLength({ min: 2, max: 100 })
        .withMessage('El nombre debe tener entre 2 y 100 caracteres'),
    body('currentPassword')
        .optional()
        .isString()
        .withMessage('La contraseña actual es inválida'),
    body('newPassword')
        .optional()
        .isLength({ min: 8 })
        .withMessage('La nueva contraseña debe tener al menos 8 caracteres'),
    validate,
    authController.updateMe
);

module.exports = router;
