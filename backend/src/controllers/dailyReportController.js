const dailyReportService = require('../services/dailyReportService');
const catchAsync = require('../utils/catchAsync');

const sendReport = (res, message, report) => {
    res.status(200).json({
        status: 'success',
        message,
        data: report
    });
};

const getDailyReport = catchAsync(async (req, res) => {
    const report = await dailyReportService.getDailyReport(req.query.date || undefined);
    sendReport(res, 'Reporte diario generado correctamente', report);
});

const getArrivalsReport = catchAsync(async (req, res) => {
    const report = await dailyReportService.getArrivalsReport(req.query.date || undefined);
    sendReport(res, 'Reporte de llegadas generado correctamente', report);
});

const getDeparturesReport = catchAsync(async (req, res) => {
    const report = await dailyReportService.getDeparturesReport(req.query.date || undefined);
    sendReport(res, 'Reporte de salidas generado correctamente', report);
});

const getCurrentOccupancyReport = catchAsync(async (req, res) => {
    const report = await dailyReportService.getCurrentOccupancyReport();
    sendReport(res, 'Reporte de ocupación actual generado correctamente', report);
});

module.exports = {
    getDailyReport,
    getArrivalsReport,
    getDeparturesReport,
    getCurrentOccupancyReport
};
