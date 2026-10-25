jest.mock('../middlewares/authMiddleware', () => ({
    protect: (req, res, next) => {
        req.user = { role: req.get('x-role') || 'ADMIN' };
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

jest.mock('../services/roomService', () => ({
    getAllRooms: jest.fn(),
    createRoom: jest.fn()
}));

const express = require('express');
const request = require('supertest');
const roomService = require('../services/roomService');
const roomRoutes = require('./roomRoutes');
const errorHandler = require('../middlewares/errorHandler');
const AppError = require('../utils/AppError');

const app = express();
app.use(express.json());
app.use('/api/v1/rooms', roomRoutes);
app.use(errorHandler);

describe('POST /api/v1/rooms', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('registers a room and confirms success', async () => {
        const room = { _id: 'room-id', number: '101', type: 'Suite', price: 150 };
        roomService.createRoom.mockResolvedValue(room);

        const response = await request(app)
            .post('/api/v1/rooms')
            .send({ number: '101', type: 'Suite', price: 150 });

        expect(response.status).toBe(201);
        expect(response.body.message).toBe('Habitación registrada correctamente');
        expect(response.body.data.room).toEqual(room);
    });

    it('returns detailed validation errors for missing required fields', async () => {
        const response = await request(app)
            .post('/api/v1/rooms')
            .send({});

        expect(response.status).toBe(400);
        expect(response.body.errors.map(({ msg }) => msg)).toEqual(expect.arrayContaining([
            'El número de habitación es obligatorio',
            'El tipo de habitación es obligatorio',
            'El precio es obligatorio'
        ]));
        expect(roomService.createRoom).not.toHaveBeenCalled();
    });

    it('returns a clear conflict when the room number already exists', async () => {
        roomService.createRoom.mockRejectedValue(
            new AppError('Ya existe una habitación con ese número', 409)
        );

        const response = await request(app)
            .post('/api/v1/rooms')
            .send({ number: '101', type: 'Suite', price: 150 });

        expect(response.status).toBe(409);
        expect(response.body.message).toBe('Ya existe una habitación con ese número');
    });

    it('allows only administrators to register a room', async () => {
        const response = await request(app)
            .post('/api/v1/rooms')
            .set('x-role', 'RECEPCIONISTA')
            .send({ number: '101', type: 'Suite', price: 150 });

        expect(response.status).toBe(403);
        expect(roomService.createRoom).not.toHaveBeenCalled();
    });
});
