const express = require('express');
const { query } = require('express-validator');

const { protect, restrictTo } = require('../middlewares/authMiddleware');
const { ROLES } = require('../constants/roles');
const validate = require('../middlewares/validate');
const dailyReportController = require('../controllers/dailyReportController');
const { isValidDateOnly } = require('../utils/reservationDates');

const router = express.Router();

router.use(
    protect,
    restrictTo(ROLES.ADMIN, ROLES.RECEPCIONISTA)
);

router.get('/dashboard', (req, res) => {
    res.status(200).json({
        status: 'success',
        message: 'Bienvenido al espacio de recepción',
        user: req.user
    });
});

const optionalReportDate = [
    query('date')
        .optional({ checkFalsy: true })
        .custom(value => typeof value === 'string')
        .withMessage('La fecha admite un solo valor')
        .bail()
        .custom(isValidDateOnly)
        .withMessage('La fecha debe tener formato AAAA-MM-DD y ser válida'),
    validate
];

router.get('/reports/daily', optionalReportDate, dailyReportController.getDailyReport);
router.get('/reports/arrivals', optionalReportDate, dailyReportController.getArrivalsReport);
router.get('/reports/departures', optionalReportDate, dailyReportController.getDeparturesReport);
router.get('/reports/occupancy', dailyReportController.getCurrentOccupancyReport);

module.exports = router;
