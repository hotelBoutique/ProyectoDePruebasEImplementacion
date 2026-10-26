const incomeReportService = require('../services/incomeReportService');
const catchAsync = require('../utils/catchAsync');

const getIncomeReport = catchAsync(async (req, res) => {
    const report = await incomeReportService.getIncomeReport(
        req.query.startDate,
        req.query.endDate
    );

    res.status(200).json({
        status: 'success',
        message: 'Reporte de ingresos generado correctamente',
        results: report.settlementCount,
        data: report
    });
});

module.exports = { getIncomeReport };
