jest.mock('../services/authService', () => ({
    logout: jest.fn(),
    updateMyProfile: jest.fn()
}));
jest.mock('../services/userService', () => ({
    createReceptionist: jest.fn(),
    createAdmin: jest.fn(),
    getReceptionists: jest.fn(),
    setReceptionistStatus: jest.fn(),
    updateReceptionist: jest.fn()
}));
jest.mock('../services/reservationService', () => ({
    getReservations: jest.fn(),
    getSettlementHistory: jest.fn(),
    getPayments: jest.fn(),
    cancelReservation: jest.fn()
}));
jest.mock('../services/occupancyReportService', () => ({ getOccupancyReport: jest.fn() }));
jest.mock('../services/incomeReportService', () => ({ getIncomeReport: jest.fn() }));
jest.mock('../services/salesReportService', () => ({ getSalesReport: jest.fn() }));
jest.mock('../services/receiptService', () => ({ getReceipt: jest.fn() }));

const authService = require('../services/authService');
const userService = require('../services/userService');
const reservationService = require('../services/reservationService');
const occupancyReportService = require('../services/occupancyReportService');
const incomeReportService = require('../services/incomeReportService');
const salesReportService = require('../services/salesReportService');
const authController = require('../controllers/authController');
const userController = require('../controllers/userController');
const reservationController = require('../controllers/reservationController');
const occupancyReportController = require('../controllers/occupancyReportController');
const incomeReportController = require('../controllers/incomeReportController');
const salesReportController = require('../controllers/salesReportController');

const invoke = async (controller, req) => {
    const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis()
    };
    const next = jest.fn();

    await controller(req, res, next);
    return { res, next };
};

describe('controladores de autenticación y cuentas', () => {
    beforeEach(() => jest.clearAllMocks());

    it('cierra la sesión de la cuenta autenticada', async () => {
        authService.logout.mockResolvedValue(undefined);

        const { res, next } = await invoke(authController.logout, { user: { _id: 'user-1' } });

        expect(authService.logout).toHaveBeenCalledWith('user-1');
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
            status: 'success',
            message: 'Sesión cerrada correctamente'
        });
        expect(next).not.toHaveBeenCalled();
    });

    it('envía los datos de perfil y usuario al servicio y devuelve el resultado', async () => {
        const result = { user: { _id: 'user-1' }, token: 'new-token' };
        authService.updateMyProfile.mockResolvedValue(result);

        const { res } = await invoke(authController.updateMe, {
            user: { _id: 'user-1' },
            body: { currentPassword: 'old', newPassword: 'new-password' }
        });

        expect(authService.updateMyProfile).toHaveBeenCalledWith('user-1', {
            currentPassword: 'old',
            newPassword: 'new-password'
        });
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({ status: 'success', data: result });
    });

    it('crea una cuenta de administrador y responde 201', async () => {
        const admin = { _id: 'admin-1', role: 'ADMIN' };
        userService.createAdmin.mockResolvedValue(admin);

        const { res } = await invoke(userController.createAdmin, {
            body: { name: 'Admin', email: 'admin@example.com', password: 'password-123' }
        });

        expect(userService.createAdmin).toHaveBeenCalledWith({
            name: 'Admin', email: 'admin@example.com', password: 'password-123'
        });
        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith({ status: 'success', data: { user: admin } });
    });

    it('devuelve la lista de recepcionistas y su cantidad', async () => {
        const users = [{ _id: 'user-1' }, { _id: 'user-2' }];
        userService.getReceptionists.mockResolvedValue(users);

        const { res } = await invoke(userController.getReceptionists, {});

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
            status: 'success',
            results: 2,
            data: { users }
        });
    });

    it('pasa el ID y cambios de una cuenta al servicio de actualización', async () => {
        const user = { _id: 'user-1', name: 'Nueva recepcionista' };
        userService.updateReceptionist.mockResolvedValue(user);

        const { res } = await invoke(userController.updateReceptionist, {
            params: { id: 'user-1' },
            body: { name: 'Nueva recepcionista' }
        });

        expect(userService.updateReceptionist).toHaveBeenCalledWith('user-1', { name: 'Nueva recepcionista' });
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({ status: 'success', data: { user } });
    });
});

describe('controladores de reservaciones y reportes', () => {
    beforeEach(() => jest.clearAllMocks());

    it('devuelve las reservaciones consultadas con filtros', async () => {
        const reservations = [{ _id: 'reservation-1' }];
        reservationService.getReservations.mockResolvedValue(reservations);

        const { res } = await invoke(reservationController.getReservations, {
            query: { status: 'reservada' }
        });

        expect(reservationService.getReservations).toHaveBeenCalledWith({ status: 'reservada' });
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
            status: 'success', results: 1, data: { reservations }
        });
    });

    it('devuelve el historial de liquidaciones', async () => {
        const settlements = [{ _id: 'settlement-1' }];
        reservationService.getSettlementHistory.mockResolvedValue(settlements);

        const { res } = await invoke(reservationController.getSettlementHistory, {});

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
            status: 'success', results: 1, data: { settlements }
        });
    });

    it('devuelve pagos y cantidad de resultados', async () => {
        const result = { payments: [{ _id: 'payment-1' }], pagination: { total: 1 } };
        reservationService.getPayments.mockResolvedValue(result);

        const { res } = await invoke(reservationController.getPayments, { query: { page: 1 } });

        expect(reservationService.getPayments).toHaveBeenCalledWith({ page: 1 });
        expect(res.json).toHaveBeenCalledWith({ status: 'success', results: 1, data: result });
    });

    it('solicita cancelar con motivo e ID del administrador autenticado', async () => {
        const reservation = { _id: 'reservation-1', status: 'cancelada' };
        reservationService.cancelReservation.mockResolvedValue(reservation);

        const { res } = await invoke(reservationController.cancelReservation, {
            params: { id: 'reservation-1' },
            body: { reason: 'Cambio de planes' },
            user: { _id: 'admin-1' }
        });

        expect(reservationService.cancelReservation).toHaveBeenCalledWith(
            'reservation-1', 'Cambio de planes', 'admin-1'
        );
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            status: 'success', data: { reservation }
        }));
    });

    it('genera el reporte de ocupación para las fechas solicitadas', async () => {
        const report = { totalRooms: 5, occupiedRooms: [] };
        occupancyReportService.getOccupancyReport.mockResolvedValue(report);

        const { res } = await invoke(occupancyReportController.getOccupancyReport, {
            query: { startDate: '2026-10-20', endDate: '2026-10-21' }
        });

        expect(occupancyReportService.getOccupancyReport).toHaveBeenCalledWith('2026-10-20', '2026-10-21');
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ results: 5, data: report }));
    });

    it('genera los reportes de ingresos y ventas con el mismo rango de fechas', async () => {
        const income = { settlementCount: 2 };
        const sales = { products: [{ description: 'Agua' }] };
        incomeReportService.getIncomeReport.mockResolvedValue(income);
        salesReportService.getSalesReport.mockResolvedValue(sales);
        const req = { query: { startDate: '2026-10-20', endDate: '2026-10-21' } };

        const incomeResult = await invoke(incomeReportController.getIncomeReport, req);
        const salesResult = await invoke(salesReportController.getSalesReport, req);

        expect(incomeReportService.getIncomeReport).toHaveBeenCalledWith('2026-10-20', '2026-10-21');
        expect(salesReportService.getSalesReport).toHaveBeenCalledWith('2026-10-20', '2026-10-21');
        expect(incomeResult.res.json).toHaveBeenCalledWith(expect.objectContaining({ results: 2, data: income }));
        expect(salesResult.res.json).toHaveBeenCalledWith(expect.objectContaining({ results: 1, data: sales }));
    });
});
