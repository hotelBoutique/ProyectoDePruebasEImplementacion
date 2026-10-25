const express = require('express');
const { body } = require('express-validator');

const roomController = require('../controllers/roomController');
const { protect, restrictTo } = require('../middlewares/authMiddleware');
const validate = require('../middlewares/validate');
const { ROLES } = require('../constants/roles');

const router = express.Router();

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
        .isIn(['disponible', 'ocupada', 'mantenimiento'])
        .withMessage('El estado debe ser disponible, ocupada o mantenimiento'),
    validate,
    roomController.createRoom
);

module.exports = router;
