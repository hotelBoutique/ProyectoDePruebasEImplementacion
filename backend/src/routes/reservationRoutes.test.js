jest.mock('../middlewares/authMiddleware', () => ({
    protect: (req, res, next) => {
        req.user = {
            _id: '507f1f77bcf86cd799439011',
            role: req.get('x-role') || 'RECEPCIONISTA'
        };
        next();
    },
    restrictTo: (...roles) => (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            const AppError = require('../utils/AppError');
            return next(new AppError('No tienes permisos para esta acción', 403));
        }
        next();
    }
}));

jest.mock('../services/reservationService', () => ({
    getAvailableRooms: jest.fn(),
    createReservation: jest.fn(),
    getPendingCheckIns: jest.fn(),
    checkInReservation: jest.fn(),
    getPendingCheckOuts: jest.fn(),
    checkOutReservation: jest.fn(),
    addReservationConsumption: jest.fn(),
    updateReservation: jest.fn(),
    cancelReservation: jest.fn(),
    getReservationConsumptions: jest.fn(),
    updateReservationConsumption: jest.fn(),
    voidReservationConsumption: jest.fn(),
    getPayments: jest.fn()
}));

jest.mock('../services/receiptService', () => ({
    getReceipt: jest.fn()
}));

jest.mock('../utils/logger', () => ({
    error: jest.fn()
}));

const express = require('express');
const request = require('supertest');
const reservationService = require('../services/reservationService');
const receiptService = require('../services/receiptService');
const reservationRoutes = require('./reservationRoutes');
const errorHandler = require('../middlewares/errorHandler');

const app = express();
app.use(express.json());
app.use('/api/v1/reservations', reservationRoutes);
app.use(errorHandler);

const getFutureDates = () => {
    const checkIn = new Date();
    checkIn.setUTCDate(checkIn.getUTCDate() + 1);
    const checkOut = new Date(checkIn);
    checkOut.setUTCDate(checkOut.getUTCDate() + 1);

    return {
        checkIn: checkIn.toISOString().slice(0, 10),
        checkOut: checkOut.toISOString().slice(0, 10)
    };
};

describe('/api/v1/reservations', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('returns available rooms for a valid date range', async () => {
        const dates = getFutureDates();
        const rooms = [{ _id: 'room-id', number: '101' }];
        reservationService.getAvailableRooms.mockResolvedValue(rooms);

        const response = await request(app)
            .get('/api/v1/reservations/availability')
            .query(dates);

        expect(response.status).toBe(200);
        expect(response.body.data.rooms).toEqual(rooms);
        expect(reservationService.getAvailableRooms).toHaveBeenCalledWith(
            dates.checkIn,
            dates.checkOut,
            undefined,
            { type: undefined, guests: undefined, maxPrice: undefined }
        );
    });

    it('passes availability filters to the service', async () => {
        const dates = getFutureDates();
        reservationService.getAvailableRooms.mockResolvedValue([]);

        const response = await request(app)
            .get('/api/v1/reservations/availability')
            .query({ ...dates, type: 'Doble', guests: '2', maxPrice: '200000' });

        expect(response.status).toBe(200);
        expect(response.body.results).toBe(0);
        expect(reservationService.getAvailableRooms).toHaveBeenCalledWith(
            dates.checkIn,
            dates.checkOut,
            undefined,
            { type: 'Doble', guests: '2', maxPrice: '200000' }
        );
    });

    it('rejects invalid availability filters', async () => {
        const dates = getFutureDates();

        const response = await request(app)
            .get('/api/v1/reservations/availability')
            .query({ ...dates, type: 'Penthouse', guests: '0', maxPrice: '-1' });

        expect(response.status).toBe(400);
        expect(response.body.errors.map(({ msg }) => msg)).toEqual(expect.arrayContaining([
            'El tipo de habitación no es válido',
            'El número de huéspedes debe ser un entero mayor o igual a 1',
            'El precio máximo debe ser un número mayor o igual a 0'
        ]));
        expect(reservationService.getAvailableRooms).not.toHaveBeenCalled();
    });

    it('requires both dates to check availability', async () => {
        const response = await request(app)
            .get('/api/v1/reservations/availability')
            .query({ type: 'Doble' });

        expect(response.status).toBe(400);
        expect(response.body.errors.map(({ msg }) => msg)).toEqual(expect.arrayContaining([
            'El check-in es obligatorio',
            'El check-out es obligatorio'
        ]));
        expect(reservationService.getAvailableRooms).not.toHaveBeenCalled();
    });

    it('reports required reservation fields and rejects invalid dates', async () => {
        const response = await request(app)
            .post('/api/v1/reservations')
            .send({ checkIn: 'not-a-date', checkOut: 'also-not-a-date' });

        expect(response.status).toBe(400);
        expect(response.body.errors.map(({ msg }) => msg)).toEqual(expect.arrayContaining([
            'Los datos del huésped son obligatorios',
            'La habitación es obligatoria',
            'El check-in debe ser una fecha válida con formato AAAA-MM-DD',
            'El check-out debe ser una fecha válida con formato AAAA-MM-DD',
            'La tarifa aplicada es obligatoria'
        ]));
        expect(reservationService.createReservation).not.toHaveBeenCalled();
    });

    it('allows a receptionist to create a reservation and returns its receipt', async () => {
        const dates = getFutureDates();
        const reservation = {
            _id: 'reservation-id',
            guest: { fullName: 'Ada Lovelace' },
            roomNumber: '101',
            roomType: 'Suite',
            checkIn: new Date(`${dates.checkIn}T00:00:00.000Z`),
            checkOut: new Date(`${dates.checkOut}T00:00:00.000Z`),
            nights: 1,
            nightlyRate: 175,
            totalAmount: 175
        };
        reservationService.createReservation.mockResolvedValue(reservation);

        const response = await request(app)
            .post('/api/v1/reservations')
            .send({
                guest: {
                    fullName: 'Ada Lovelace',
                    email: 'ada@example.com',
                    phone: '123456789',
                    identification: 'AB1234'
                },
                roomId: '507f1f77bcf86cd799439012',
                ...dates,
                nightlyRate: 175
            });

        expect(response.status).toBe(201);
        expect(response.body.message).toBe('La reservación se confirmó correctamente');
        expect(response.body.data.receipt.roomNumber).toBe('101');
        expect(reservationService.createReservation).toHaveBeenCalledWith(expect.objectContaining({
            roomId: '507f1f77bcf86cd799439012',
            createdBy: '507f1f77bcf86cd799439011',
            nightlyRate: 175
        }));
    });

    it('does not allow administrators to create reservations', async () => {
        const response = await request(app)
            .post('/api/v1/reservations')
            .set('x-role', 'ADMIN')
            .send({});

        expect(response.status).toBe(403);
        expect(reservationService.createReservation).not.toHaveBeenCalled();
    });

    it('lists scheduled check-ins for reception', async () => {
        const reservations = [{ _id: 'reservation-id' }];
        reservationService.getPendingCheckIns.mockResolvedValue(reservations);

        const response = await request(app).get('/api/v1/reservations/check-ins/pending');

        expect(response.status).toBe(200);
        expect(response.body.data.reservations).toEqual(reservations);
        expect(reservationService.getPendingCheckIns).toHaveBeenCalled();
    });

    it('registers check-in and confirms the room state change', async () => {
        const reservation = {
            _id: '507f1f77bcf86cd799439012',
            status: 'ocupada',
            checkInAt: '2026-10-25T12:00:00.000Z'
        };
        reservationService.checkInReservation.mockResolvedValue(reservation);

        const response = await request(app)
            .post('/api/v1/reservations/507f1f77bcf86cd799439012/check-in');

        expect(response.status).toBe(200);
        expect(response.body.message).toContain('check-in se registró correctamente');
        expect(response.body.data.reservation.status).toBe('ocupada');
        expect(reservationService.checkInReservation).toHaveBeenCalledWith('507f1f77bcf86cd799439012');
    });

    it('rejects invalid check-in identifiers and denies administrators', async () => {
        const invalidId = await request(app)
            .post('/api/v1/reservations/not-an-id/check-in');
        expect(invalidId.status).toBe(400);
        expect(reservationService.checkInReservation).not.toHaveBeenCalled();

        const forbidden = await request(app)
            .post('/api/v1/reservations/507f1f77bcf86cd799439012/check-in')
            .set('x-role', 'ADMIN');
        expect(forbidden.status).toBe(403);
        expect(reservationService.checkInReservation).not.toHaveBeenCalled();
    });

    it('lists active stays for reception checkout', async () => {
        const reservations = [{ _id: 'reservation-id', settlementEstimate: { total: 200 } }];
        reservationService.getPendingCheckOuts.mockResolvedValue(reservations);

        const response = await request(app).get('/api/v1/reservations/check-outs/pending');

        expect(response.status).toBe(200);
        expect(response.body.data.reservations).toEqual(reservations);
        expect(reservationService.getPendingCheckOuts).toHaveBeenCalled();
    });

    it('accepts a valid checkout payment and returns the receipt', async () => {
        const receipt = {
            _id: '507f1f77bcf86cd799439012',
            status: 'finalizada',
            settlement: { status: 'pagada', totalAmount: 250 }
        };
        reservationService.checkOutReservation.mockResolvedValue(receipt);

        const response = await request(app)
            .post('/api/v1/reservations/507f1f77bcf86cd799439012/check-out')
            .send({
                paidAmount: 250,
                paymentMethod: 'tarjeta',
                additionalCharges: [{ description: 'Minibar', quantity: 2, unitPrice: 25 }]
            });

        expect(response.status).toBe(200);
        expect(response.body.data.receipt.settlement.totalAmount).toBe(250);
        expect(reservationService.checkOutReservation).toHaveBeenCalledWith({
            reservationId: '507f1f77bcf86cd799439012',
            paidAmount: 250,
            paymentMethod: 'tarjeta',
            additionalCharges: [{ description: 'Minibar', quantity: 2, unitPrice: 25 }]
        });
    });

    it('validates checkout payment fields and restricts checkout to reception', async () => {
        const invalid = await request(app)
            .post('/api/v1/reservations/507f1f77bcf86cd799439012/check-out')
            .send({
                paidAmount: -1,
                paymentMethod: 'cheque',
                additionalCharges: [{ description: 'Minibar', quantity: -1, unitPrice: -10 }]
            });
        expect(invalid.status).toBe(400);
        expect(reservationService.checkOutReservation).not.toHaveBeenCalled();

        const forbidden = await request(app)
            .post('/api/v1/reservations/507f1f77bcf86cd799439012/check-out')
            .set('x-role', 'ADMIN')
            .send({ paidAmount: 100, paymentMethod: 'efectivo' });
        expect(forbidden.status).toBe(403);
        expect(reservationService.checkOutReservation).not.toHaveBeenCalled();
    });

    it('registers a consumption for an active receptionist stay', async () => {
        reservationService.addReservationConsumption.mockResolvedValue({
            _id: 'reservation-id',
            consumptions: [{ description: 'Minibar', quantity: 2, unitPrice: 20, subtotal: 40 }]
        });

        const response = await request(app)
            .post('/api/v1/reservations/507f1f77bcf86cd799439012/consumptions')
            .send({ description: 'Minibar', quantity: 2, unitPrice: 20 });

        expect(response.status).toBe(201);
        expect(response.body.message).toContain('consumo se registró');
        expect(reservationService.addReservationConsumption).toHaveBeenCalledWith(
            '507f1f77bcf86cd799439012',
            { description: 'Minibar', quantity: 2, unitPrice: 20 }
        );
    });

    it('validates consumption details and denies administrators', async () => {
        const invalid = await request(app)
            .post('/api/v1/reservations/507f1f77bcf86cd799439012/consumptions')
            .send({ description: 'x', quantity: 0, unitPrice: -1 });
        expect(invalid.status).toBe(400);
        expect(reservationService.addReservationConsumption).not.toHaveBeenCalled();

        const forbidden = await request(app)
            .post('/api/v1/reservations/507f1f77bcf86cd799439012/consumptions')
            .set('x-role', 'ADMIN')
            .send({ description: 'Minibar', quantity: 1, unitPrice: 5 });
        expect(forbidden.status).toBe(403);
        expect(reservationService.addReservationConsumption).not.toHaveBeenCalled();
    });

    it('lists consumption history for an active stay', async () => {
        reservationService.getReservationConsumptions.mockResolvedValue({
            reservationId: '507f1f77bcf86cd799439012',
            consumptions: [{ description: 'Minibar', quantity: 2, subtotal: 40 }],
            total: 40
        });

        const response = await request(app)
            .get('/api/v1/reservations/507f1f77bcf86cd799439012/consumptions');

        expect(response.status).toBe(200);
        expect(response.body.results).toBe(1);
        expect(reservationService.getReservationConsumptions).toHaveBeenCalledWith(
            '507f1f77bcf86cd799439012'
        );
    });

    it('corrects a consumption and returns the updated reservation', async () => {
        reservationService.updateReservationConsumption.mockResolvedValue({
            _id: '507f1f77bcf86cd799439012'
        });

        const response = await request(app)
            .patch('/api/v1/reservations/507f1f77bcf86cd799439012/consumptions/507f1f77bcf86cd799439013')
            .send({ quantity: 3, unitPrice: 25 });

        expect(response.status).toBe(200);
        expect(response.body.message).toContain('consumo se corrigió');
        expect(reservationService.updateReservationConsumption).toHaveBeenCalledWith(
            '507f1f77bcf86cd799439012',
            '507f1f77bcf86cd799439013',
            { quantity: 3, unitPrice: 25 }
        );
    });

    it('voids a consumption and denies administrators', async () => {
        reservationService.voidReservationConsumption.mockResolvedValue({
            _id: '507f1f77bcf86cd799439012'
        });

        const response = await request(app)
            .post('/api/v1/reservations/507f1f77bcf86cd799439012/consumptions/507f1f77bcf86cd799439013/void')
            .send({ reason: 'Cargo registrado por error' });

        expect(response.status).toBe(200);
        expect(response.body.message).toContain('consumo se anuló');

        reservationService.voidReservationConsumption.mockClear();
        const forbidden = await request(app)
            .post('/api/v1/reservations/507f1f77bcf86cd799439012/consumptions/507f1f77bcf86cd799439013/void')
            .set('x-role', 'ADMIN')
            .send({ reason: 'Cargo registrado por error' });
        expect(forbidden.status).toBe(403);
        expect(reservationService.voidReservationConsumption).not.toHaveBeenCalled();
    });

    it('validates consumption IDs and correction payloads', async () => {
        const invalidId = await request(app)
            .patch('/api/v1/reservations/invalid/consumptions/also-invalid')
            .send({ quantity: 2 });
        expect(invalidId.status).toBe(400);

        const empty = await request(app)
            .patch('/api/v1/reservations/507f1f77bcf86cd799439012/consumptions/507f1f77bcf86cd799439013')
            .send({});
        expect(empty.status).toBe(400);

        const unknown = await request(app)
            .patch('/api/v1/reservations/507f1f77bcf86cd799439012/consumptions/507f1f77bcf86cd799439013')
            .send({ status: 'anulado' });
        expect(unknown.status).toBe(400);
        expect(reservationService.updateReservationConsumption).not.toHaveBeenCalled();
    });

    it('allows reception and administration to cancel reservations before check-in', async () => {
        reservationService.cancelReservation.mockResolvedValue({
            _id: '507f1f77bcf86cd799439012',
            status: 'cancelada'
        });

        const receptionist = await request(app)
            .post('/api/v1/reservations/507f1f77bcf86cd799439012/cancel')
            .send({ reason: 'Huésped canceló su viaje' });
        expect(receptionist.status).toBe(200);
        expect(reservationService.cancelReservation).toHaveBeenCalledWith(
            '507f1f77bcf86cd799439012',
            'Huésped canceló su viaje',
            '507f1f77bcf86cd799439011'
        );

        reservationService.cancelReservation.mockClear();
        const admin = await request(app)
            .post('/api/v1/reservations/507f1f77bcf86cd799439012/cancel')
            .set('x-role', 'ADMIN')
            .send({ reason: 'Cambio administrativo del viaje' });
        expect(admin.status).toBe(200);
        expect(reservationService.cancelReservation).toHaveBeenCalled();
    });

    it('validates cancellation reason and identifier', async () => {
        const invalidReason = await request(app)
            .post('/api/v1/reservations/507f1f77bcf86cd799439012/cancel')
            .send({ reason: 'x' });
        expect(invalidReason.status).toBe(400);

        const invalidId = await request(app)
            .post('/api/v1/reservations/invalid/cancel')
            .send({ reason: 'Cambio de planes del huésped' });
        expect(invalidId.status).toBe(400);
        expect(reservationService.cancelReservation).not.toHaveBeenCalled();
    });
});

describe('payment receipts', () => {
    const reservationId = '507f1f77bcf86cd799439012';

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('lets receptionists and administrators get a receipt', async () => {
        receiptService.getReceipt.mockResolvedValue({ receiptNumber: 'CP-000007' });

        const reception = await request(app).get(`/api/v1/reservations/${reservationId}/receipt`);
        const admin = await request(app)
            .get(`/api/v1/reservations/${reservationId}/receipt`)
            .set('x-role', 'ADMIN');

        expect(reception.status).toBe(200);
        expect(reception.body.message).toBe('Comprobante CP-000007 generado correctamente');
        expect(reception.body.data.receipt.receiptNumber).toBe('CP-000007');
        expect(admin.status).toBe(200);
        expect(receiptService.getReceipt).toHaveBeenCalledWith(reservationId);
    });

    it('rejects an invalid reservation id', async () => {
        const response = await request(app).get('/api/v1/reservations/no-es-un-id/receipt');

        expect(response.status).toBe(400);
        expect(response.body.errors.map(({ msg }) => msg))
            .toContain('El identificador de la reservación no es válido');
        expect(receiptService.getReceipt).not.toHaveBeenCalled();
    });

    it('returns 404 when the stay has not been paid', async () => {
        const AppError = require('../utils/AppError');
        receiptService.getReceipt.mockRejectedValue(
            new AppError('Solo se emite comprobante para estancias finalizadas y pagadas', 404)
        );

        const response = await request(app).get(`/api/v1/reservations/${reservationId}/receipt`);

        expect(response.status).toBe(404);
        expect(response.body.message).toBe('Solo se emite comprobante para estancias finalizadas y pagadas');
    });

    it('lets receptionists search receipts while payments stay restricted to administrators', async () => {
        reservationService.getPayments.mockResolvedValue({ payments: [], pagination: {}, summary: {} });

        const receipts = await request(app)
            .get('/api/v1/reservations/receipts')
            .query({ q: 'CP-0000', paymentMethod: 'efectivo' });
        const payments = await request(app).get('/api/v1/reservations/payments');

        expect(receipts.status).toBe(200);
        expect(reservationService.getPayments).toHaveBeenCalledWith(
            expect.objectContaining({ q: 'CP-0000', paymentMethod: 'efectivo' })
        );
        expect(payments.status).toBe(403);
    });

    it('validates receipt search filters', async () => {
        const response = await request(app)
            .get('/api/v1/reservations/receipts')
            .query({ paymentMethod: 'cheque', startDate: '2026-10-20', endDate: '2026-10-01' });

        expect(response.status).toBe(400);
        expect(response.body.errors.map(({ msg }) => msg)).toEqual(expect.arrayContaining([
            'El método de pago no es válido',
            'La fecha final debe ser igual o posterior a la fecha inicial'
        ]));
        expect(reservationService.getPayments).not.toHaveBeenCalled();
    });
});
