const salesReportService = require('../services/salesReportService');
const catchAsync = require('../utils/catchAsync');

const getSalesReport = catchAsync(async (req, res) => {
    const report = await salesReportService.getSalesReport(
        req.query.startDate,
        req.query.endDate
    );

    res.status(200).json({
        status: 'success',
        message: 'Reporte de ventas de productos generado correctamente',
        results: report.products.length,
        data: report
    });
});

module.exports = { getSalesReport };
