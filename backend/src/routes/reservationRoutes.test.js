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
    checkInReservation: jest.fn()
}));

jest.mock('../utils/logger', () => ({
    error: jest.fn()
}));

const express = require('express');
const request = require('supertest');
const reservationService = require('../services/reservationService');
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
            undefined
        );
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
});
