const express = require('express');
const { body, param } = require('express-validator');

const userController = require('../controllers/userController');
const { protect, restrictTo } = require('../middlewares/authMiddleware');
const validate = require('../middlewares/validate');
const { ROLES } = require('../constants/roles');

const router = express.Router();

router.use(protect, restrictTo(ROLES.ADMIN));

router.get('/', userController.getReceptionists);

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

module.exports = router;
