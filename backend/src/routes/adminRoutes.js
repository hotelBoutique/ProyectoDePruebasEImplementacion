const express = require('express');
const { query } = require('express-validator');

const {protect, restrictTo} = require('../middlewares/authMiddleware');
const { ROLES } = require('../constants/roles');
const validate = require('../middlewares/validate');
const occupancyReportController = require('../controllers/occupancyReportController');
const incomeReportController = require('../controllers/incomeReportController');
const salesReportController = require('../controllers/salesReportController');
const { isValidDateOnly } = require('../utils/reservationDates');

const router = express.Router();

router.use(protect, restrictTo(ROLES.ADMIN));

router.get(
    '/reports/occupancy',
    query(['startDate', 'endDate'])
        .custom(value => typeof value === 'string')
        .withMessage('Cada fecha admite un solo valor'),
    query('startDate')
        .notEmpty()
        .withMessage('La fecha inicial es obligatoria')
        .bail()
        .custom(isValidDateOnly)
        .withMessage('La fecha inicial debe tener formato AAAA-MM-DD y ser válida'),
    query('endDate')
        .notEmpty()
        .withMessage('La fecha final es obligatoria')
        .bail()
        .custom(isValidDateOnly)
        .withMessage('La fecha final debe tener formato AAAA-MM-DD y ser válida')
        .bail()
        .custom((endDate, { req }) => !isValidDateOnly(req.query.startDate) || endDate >= req.query.startDate)
        .withMessage('La fecha final debe ser igual o posterior a la fecha inicial'),
    validate,
    occupancyReportController.getOccupancyReport
);

router.get(
    '/reports/income',
    query(['startDate', 'endDate'])
        .custom(value => typeof value === 'string')
        .withMessage('Cada fecha admite un solo valor'),
    query('startDate')
        .notEmpty()
        .withMessage('La fecha inicial es obligatoria')
        .bail()
        .custom(isValidDateOnly)
        .withMessage('La fecha inicial debe tener formato AAAA-MM-DD y ser válida'),
    query('endDate')
        .notEmpty()
        .withMessage('La fecha final es obligatoria')
        .bail()
        .custom(isValidDateOnly)
        .withMessage('La fecha final debe tener formato AAAA-MM-DD y ser válida')
        .bail()
        .custom((endDate, { req }) => !isValidDateOnly(req.query.startDate) || endDate >= req.query.startDate)
        .withMessage('La fecha final debe ser igual o posterior a la fecha inicial'),
    validate,
    incomeReportController.getIncomeReport
);

router.get(
    '/reports/sales',
    query(['startDate', 'endDate'])
        .custom(value => typeof value === 'string')
        .withMessage('Cada fecha admite un solo valor'),
    query('startDate')
        .notEmpty()
        .withMessage('La fecha inicial es obligatoria')
        .bail()
        .custom(isValidDateOnly)
        .withMessage('La fecha inicial debe tener formato AAAA-MM-DD y ser válida'),
    query('endDate')
        .notEmpty()
        .withMessage('La fecha final es obligatoria')
        .bail()
        .custom(isValidDateOnly)
        .withMessage('La fecha final debe tener formato AAAA-MM-DD y ser válida')
        .bail()
        .custom((endDate, { req }) => !isValidDateOnly(req.query.startDate) || endDate >= req.query.startDate)
        .withMessage('La fecha final debe ser igual o posterior a la fecha inicial'),
    validate,
    salesReportController.getSalesReport
);

router.get('/dashboard', (req, res) => {
    res.status(200).json({
        status: 'success',
        message: 'Bienvenido al panel de administración',
        user: req.user
    });
});

module.exports = router;
