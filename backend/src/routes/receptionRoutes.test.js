jest.mock('../middlewares/authMiddleware', () => ({
    protect: (req, res, next) => {
        req.user = { role: req.get('x-role') || 'RECEPCIONISTA' };
        next();
    },
    restrictTo: (...roles) => (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'No tienes permisos para esta acción'
            });
        }
        next();
    }
}));

jest.mock('../services/dailyReportService', () => ({
    getDailyReport: jest.fn(),
    getArrivalsReport: jest.fn(),
    getDeparturesReport: jest.fn(),
    getCurrentOccupancyReport: jest.fn()
}));

const express = require('express');
const request = require('supertest');
const dailyReportService = require('../services/dailyReportService');
const receptionRoutes = require('./receptionRoutes');
const errorHandler = require('../middlewares/errorHandler');

const app = express();
app.use(express.json());
app.use('/api/v1/reception', receptionRoutes);
app.use(errorHandler);

const DATED_REPORTS = [
    ['daily', 'getDailyReport', 'Reporte diario generado correctamente'],
    ['arrivals', 'getArrivalsReport', 'Reporte de llegadas generado correctamente'],
    ['departures', 'getDeparturesReport', 'Reporte de salidas generado correctamente']
];

describe('reception reports by date', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        DATED_REPORTS.forEach(([, method]) => {
            dailyReportService[method].mockResolvedValue({ date: '2026-10-26', summary: {} });
        });
    });

    describe.each(DATED_REPORTS)('GET /api/v1/reception/reports/%s', (path, method, message) => {
        const url = `/api/v1/reception/reports/${path}`;

        it('uses today when no date is given', async () => {
            const response = await request(app).get(url);

            expect(response.status).toBe(200);
            expect(response.body.message).toBe(message);
            expect(dailyReportService[method]).toHaveBeenCalledWith(undefined);
        });

        it('uses the requested date', async () => {
            const response = await request(app).get(url).query({ date: '2026-10-20' });

            expect(response.status).toBe(200);
            expect(dailyReportService[method]).toHaveBeenCalledWith('2026-10-20');
        });

        it('rejects an invalid date', async () => {
            const response = await request(app).get(url).query({ date: '2026-02-30' });

            expect(response.status).toBe(400);
            expect(response.body.errors.map(({ msg }) => msg))
                .toContain('La fecha debe tener formato AAAA-MM-DD y ser válida');
            expect(dailyReportService[method]).not.toHaveBeenCalled();
        });
    });

    it('rejects a date sent more than once', async () => {
        const response = await request(app)
            .get('/api/v1/reception/reports/daily?date=2026-10-20&date=2026-10-21');

        expect(response.status).toBe(400);
        expect(response.body.errors.map(({ msg }) => msg)).toContain('La fecha admite un solo valor');
        expect(dailyReportService.getDailyReport).not.toHaveBeenCalled();
    });

    it('is also available to administrators', async () => {
        const response = await request(app)
            .get('/api/v1/reception/reports/daily')
            .set('x-role', 'ADMIN');

        expect(response.status).toBe(200);
    });
});

describe('GET /api/v1/reception/reports/occupancy', () => {
    it('returns the current occupancy', async () => {
        dailyReportService.getCurrentOccupancyReport.mockResolvedValue({ summary: { occupied: 2 }, rooms: [] });

        const response = await request(app).get('/api/v1/reception/reports/occupancy');

        expect(response.status).toBe(200);
        expect(response.body.message).toBe('Reporte de ocupación actual generado correctamente');
        expect(response.body.data.summary.occupied).toBe(2);
    });
});
