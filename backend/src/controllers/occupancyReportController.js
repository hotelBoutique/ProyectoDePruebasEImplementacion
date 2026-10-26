const occupancyReportService = require('../services/occupancyReportService');
const catchAsync = require('../utils/catchAsync');

const getOccupancyReport = catchAsync(async (req, res) => {
    const report = await occupancyReportService.getOccupancyReport(
        req.query.startDate,
        req.query.endDate
    );

    res.status(200).json({
        status: 'success',
        message: 'Reporte de ocupación generado correctamente',
        results: report.totalRooms,
        data: report
    });
});

module.exports = { getOccupancyReport };
