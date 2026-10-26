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
    createRoom: jest.fn(),
    updateRoom: jest.fn()
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

describe('GET /api/v1/rooms', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('lists rooms for receptionists without filters', async () => {
        const rooms = [{ _id: 'room-id', number: '101' }];
        roomService.getAllRooms.mockResolvedValue(rooms);

        const response = await request(app)
            .get('/api/v1/rooms')
            .set('x-role', 'RECEPCIONISTA');

        expect(response.status).toBe(200);
        expect(response.body.results).toBe(1);
        expect(response.body.data.rooms).toEqual(rooms);
    });

    it('passes valid filters to the service', async () => {
        roomService.getAllRooms.mockResolvedValue([{ _id: 'room-id', number: '101' }]);

        const response = await request(app)
            .get('/api/v1/rooms')
            .query({ status: 'disponible', type: 'Suite', minCapacity: '2', minPrice: '100', maxPrice: '300' });

        expect(response.status).toBe(200);
        expect(roomService.getAllRooms).toHaveBeenCalledWith({
            status: 'disponible',
            type: 'Suite',
            minCapacity: '2',
            minPrice: '100',
            maxPrice: '300'
        });
    });

    it('explains when no room matches the filters', async () => {
        roomService.getAllRooms.mockResolvedValue([]);

        const response = await request(app)
            .get('/api/v1/rooms')
            .query({ status: 'limpieza' });

        expect(response.status).toBe(200);
        expect(response.body.results).toBe(0);
        expect(response.body.message).toBe('No hay habitaciones que coincidan con los filtros');
    });

    it('keeps the original message when the inventory is empty', async () => {
        roomService.getAllRooms.mockResolvedValue([]);

        const response = await request(app).get('/api/v1/rooms');

        expect(response.body.message).toBe('No existen habitaciones registradas');
    });

    it('rejects invalid filter values', async () => {
        const response = await request(app)
            .get('/api/v1/rooms')
            .query({ status: 'perdida', minCapacity: '0', minPrice: '-5' });

        expect(response.status).toBe(400);
        expect(response.body.errors.map(({ msg }) => msg)).toEqual(expect.arrayContaining([
            'El estado no es válido',
            'La capacidad mínima debe ser un número entero mayor o igual a 1',
            'El precio mínimo debe ser un número mayor o igual a 0'
        ]));
        expect(roomService.getAllRooms).not.toHaveBeenCalled();
    });

    it('rejects a maximum price below the minimum price', async () => {
        const response = await request(app)
            .get('/api/v1/rooms')
            .query({ minPrice: '300', maxPrice: '100' });

        expect(response.status).toBe(400);
        expect(response.body.errors.map(({ msg }) => msg))
            .toContain('El precio máximo debe ser mayor o igual al precio mínimo');
        expect(roomService.getAllRooms).not.toHaveBeenCalled();
    });

    it('rejects a filter sent more than once', async () => {
        const response = await request(app)
            .get('/api/v1/rooms?status=disponible&status=ocupada');

        expect(response.status).toBe(400);
        expect(response.body.errors.map(({ msg }) => msg)).toContain('Cada filtro admite un solo valor');
        expect(roomService.getAllRooms).not.toHaveBeenCalled();
    });
});

describe('POST /api/v1/rooms', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('allows an administrator to register a room and confirms success', async () => {
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

    it('rejects receptionists attempting to register a room', async () => {
        const response = await request(app)
            .post('/api/v1/rooms')
            .set('x-role', 'RECEPCIONISTA')
            .send({ number: '101', type: 'Suite', price: 150 });

        expect(response.status).toBe(403);
        expect(roomService.createRoom).not.toHaveBeenCalled();
    });
});

describe('PATCH /api/v1/rooms/:id', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('updates room information and confirms the change', async () => {
        const room = { _id: '507f1f77bcf86cd799439011', number: '102', price: 200 };
        roomService.updateRoom.mockResolvedValue(room);

        const response = await request(app)
            .patch('/api/v1/rooms/507f1f77bcf86cd799439011')
            .send({ number: '102', price: 200 });

        expect(response.status).toBe(200);
        expect(response.body.message).toBe('La habitación se actualizó correctamente');
        expect(response.body.data.room).toEqual(room);
    });

    it('rejects required fields left blank', async () => {
        const response = await request(app)
            .patch('/api/v1/rooms/507f1f77bcf86cd799439011')
            .send({ type: ' ' });

        expect(response.status).toBe(400);
        expect(response.body.errors.map(({ msg }) => msg)).toContain('El tipo de habitación es obligatorio');
        expect(roomService.updateRoom).not.toHaveBeenCalled();
    });

    it('returns a clear conflict for a duplicate room number', async () => {
        roomService.updateRoom.mockRejectedValue(
            new AppError('Ya existe una habitación con ese número', 409)
        );

        const response = await request(app)
            .patch('/api/v1/rooms/507f1f77bcf86cd799439011')
            .send({ number: '102' });

        expect(response.status).toBe(409);
        expect(response.body.message).toBe('Ya existe una habitación con ese número');
    });

    it('allows administrators to deactivate a room', async () => {
        roomService.updateRoom.mockResolvedValue({
            _id: '507f1f77bcf86cd799439011',
            status: 'fuera de servicio'
        });

        const response = await request(app)
            .patch('/api/v1/rooms/507f1f77bcf86cd799439011')
            .send({ status: 'fuera de servicio' });

        expect(response.status).toBe(200);
        expect(response.body.message).toBe('La habitación se desactivó correctamente');
        expect(response.body.data.room.status).toBe('fuera de servicio');
    });

    it('keeps room updates restricted to administrators', async () => {
        const response = await request(app)
            .patch('/api/v1/rooms/507f1f77bcf86cd799439011')
            .set('x-role', 'RECEPCIONISTA')
            .send({ price: 200 });

        expect(response.status).toBe(403);
        expect(roomService.updateRoom).not.toHaveBeenCalled();
    });
});
