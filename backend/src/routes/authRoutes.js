const express = require('express');
const { body } = require('express-validator');

const authController = require('../controllers/authController');
const validate = require('../middlewares/validate');

const {protect} = require('../middlewares/authMiddleware');

const router = express.Router();

router.post('/register',

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

router.get('/me',
    protect,
    authController.me
);

module.exports = router;