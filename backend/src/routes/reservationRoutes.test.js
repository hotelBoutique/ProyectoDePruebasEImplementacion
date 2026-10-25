jest.mock('../middlewares/authMiddleware', () => ({
    protect: (req, res, next) => {
        req.user = {
            _id: 'user-id',
            role: req.get('x-role') || 'ADMIN'
        };
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

jest.mock('../services/reservationService', () => ({
    getAvailableRooms: jest.fn(),
    createReservation: jest.fn()
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

describe('Reservation routes', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('returns available rooms for a valid date range', async () => {
        reservationService.getAvailableRooms.mockResolvedValue([{ _id: 'room-id' }]);

        const response = await request(app)
            .get('/api/v1/reservations/availability')
            .query({ checkIn: '2026-11-01', checkOut: '2026-11-03' });

        expect(response.status).toBe(200);
        expect(response.body.data.rooms).toEqual([{ _id: 'room-id' }]);
    });

    it('rejects invalid date ranges', async () => {
        const response = await request(app)
            .get('/api/v1/reservations/availability')
            .query({ checkIn: '2026-11-03', checkOut: '2026-11-01' });

        expect(response.status).toBe(400);
        expect(response.body.errors.map(({ msg }) => msg)).toContain(
            'El check-out debe ser posterior al check-in'
        );
        expect(reservationService.getAvailableRooms).not.toHaveBeenCalled();
    });

    it('allows a receptionist to create a reservation', async () => {
        const reservation = {
            _id: 'reservation-id',
            roomNumber: '101',
            totalAmount: 300
        };
        reservationService.createReservation.mockResolvedValue(reservation);

        const response = await request(app)
            .post('/api/v1/reservations')
            .set('x-role', 'RECEPCIONISTA')
            .send({
                guest: {
                    fullName: 'Ada Lovelace',
                    email: 'ada@example.com',
                    phone: '3001234567',
                    identification: 'CC123456'
                },
                roomId: '507f1f77bcf86cd799439011',
                checkIn: '2026-11-01',
                checkOut: '2026-11-03',
                nightlyRate: 150
            });

        expect(response.status).toBe(201);
        expect(response.body.message).toBe('La reservación se confirmó correctamente');
        expect(response.body.data.receipt.totalAmount).toBe(300);
        expect(reservationService.createReservation).toHaveBeenCalledWith(expect.objectContaining({
            createdBy: 'user-id'
        }));
    });

    it('rejects administrators attempting to create a reservation', async () => {
        const response = await request(app)
            .post('/api/v1/reservations')
            .set('x-role', 'ADMIN')
            .send({
                guest: {
                    fullName: 'Ada Lovelace',
                    email: 'ada@example.com',
                    phone: '3001234567',
                    identification: 'CC123456'
                },
                roomId: '507f1f77bcf86cd799439011',
                checkIn: '2026-11-01',
                checkOut: '2026-11-03',
                nightlyRate: 150
            });

        expect(response.status).toBe(403);
        expect(reservationService.createReservation).not.toHaveBeenCalled();
    });

    it('reports missing guest data and rate validation errors', async () => {
        const response = await request(app)
            .post('/api/v1/reservations')
            .set('x-role', 'RECEPCIONISTA')
            .send({
                guest: {},
                roomId: '507f1f77bcf86cd799439011',
                checkIn: '2026-11-01',
                checkOut: '2026-11-03',
                nightlyRate: -5
            });

        expect(response.status).toBe(400);
        expect(response.body.errors.map(({ msg }) => msg)).toEqual(expect.arrayContaining([
            'El nombre completo del huésped es obligatorio',
            'El correo del huésped es obligatorio',
            'El teléfono del huésped es obligatorio',
            'La identificación del huésped es obligatoria',
            'La tarifa aplicada debe ser un número mayor o igual a 0'
        ]));
        expect(reservationService.createReservation).not.toHaveBeenCalled();
    });
});
