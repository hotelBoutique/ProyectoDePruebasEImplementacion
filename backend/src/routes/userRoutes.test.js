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

jest.mock('../services/userService', () => ({
    createAdmin: jest.fn(),
    createReceptionist: jest.fn(),
    getReceptionists: jest.fn(),
    setReceptionistStatus: jest.fn(),
    updateReceptionist: jest.fn()
}));

jest.mock('../utils/logger', () => ({
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn()
}));

const express = require('express');
const request = require('supertest');
const userService = require('../services/userService');
const userRoutes = require('./userRoutes');
const errorHandler = require('../middlewares/errorHandler');
const AppError = require('../utils/AppError');

const app = express();
app.use(express.json());
app.use('/api/v1/users', userRoutes);
app.use(errorHandler);

describe('userRoutes', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('GET /api/v1/users', () => {
        it('returns receptionists for an administrator', async () => {
            const users = [
                { _id: 'user-id', name: 'Ana', email: 'ana@example.com', role: 'RECEPCIONISTA' }
            ];
            userService.getReceptionists.mockResolvedValue(users);

            const response = await request(app)
                .get('/api/v1/users');

            expect(response.status).toBe(200);
            expect(response.body.results).toBe(1);
            expect(response.body.data.users).toEqual(users);
            expect(userService.getReceptionists).toHaveBeenCalledTimes(1);
        });

        it('rejects receptionists', async () => {
            const response = await request(app)
                .get('/api/v1/users')
                .set('x-role', 'RECEPCIONISTA');

            expect(response.status).toBe(403);
            expect(userService.getReceptionists).not.toHaveBeenCalled();
        });
    });

    describe('POST /api/v1/users/admin', () => {
        it('creates an administrator with the validated body', async () => {
            const createdUser = {
                _id: 'admin-id',
                name: 'Admin',
                email: 'admin@example.com',
                role: 'ADMIN'
            };
            userService.createAdmin.mockResolvedValue(createdUser);

            const response = await request(app)
                .post('/api/v1/users/admin')
                .send({
                    name: 'Admin',
                    email: 'ADMIN@EXAMPLE.COM',
                    password: 'password123'
                });

            expect(response.status).toBe(201);
            expect(response.body.data.user).toEqual(createdUser);
            expect(userService.createAdmin).toHaveBeenCalledWith({
                name: 'Admin',
                email: 'admin@example.com',
                password: 'password123'
            });
        });
    });

    describe('POST /api/v1/users', () => {
        it('creates a receptionist', async () => {
            const createdUser = {
                _id: 'receptionist-id',
                name: 'Recepción',
                email: 'reception@example.com',
                role: 'RECEPCIONISTA'
            };
            userService.createReceptionist.mockResolvedValue(createdUser);

            const response = await request(app)
                .post('/api/v1/users')
                .send({
                    name: 'Recepción',
                    email: 'reception@example.com',
                    password: 'password123'
                });

            expect(response.status).toBe(201);
            expect(response.body.data.user).toEqual(createdUser);
            expect(userService.createReceptionist).toHaveBeenCalledWith({
                name: 'Recepción',
                email: 'reception@example.com',
                password: 'password123'
            });
        });

        it('rejects invalid account data without calling the service', async () => {
            const response = await request(app)
                .post('/api/v1/users')
                .send({ name: 'A', email: 'invalid', password: 'short' });

            expect(response.status).toBe(400);
            expect(response.body.errors.length).toBeGreaterThan(0);
            expect(userService.createReceptionist).not.toHaveBeenCalled();
        });

        it('propagates a duplicate email conflict', async () => {
            userService.createReceptionist.mockRejectedValue(
                new AppError('El correo ya está registrado', 409)
            );

            const response = await request(app)
                .post('/api/v1/users')
                .send({
                    name: 'Recepción',
                    email: 'reception@example.com',
                    password: 'password123'
                });

            expect(response.status).toBe(409);
            expect(response.body.message).toBe('El correo ya está registrado');
        });
    });

    describe('PATCH /api/v1/users/:id/status', () => {
        it('updates the receptionist status', async () => {
            const user = { _id: '507f1f77bcf86cd799439011', isActive: false };
            userService.setReceptionistStatus.mockResolvedValue(user);

            const response = await request(app)
                .patch('/api/v1/users/507f1f77bcf86cd799439011/status')
                .send({ isActive: false });

            expect(response.status).toBe(200);
            expect(response.body.data.user).toEqual(user);
            expect(userService.setReceptionistStatus).toHaveBeenCalledWith(
                '507f1f77bcf86cd799439011',
                false
            );
        });

        it('rejects an invalid identifier or status', async () => {
            const response = await request(app)
                .patch('/api/v1/users/not-an-id/status')
                .send({ isActive: 'false' });

            expect(response.status).toBe(400);
            expect(userService.setReceptionistStatus).not.toHaveBeenCalled();
        });
    });

    describe('PATCH /api/v1/users/:id', () => {
        it('updates allowed receptionist fields', async () => {
            const changes = { name: 'Nuevo nombre', isActive: true };
            const user = { _id: '507f1f77bcf86cd799439011', ...changes };
            userService.updateReceptionist.mockResolvedValue(user);

            const response = await request(app)
                .patch('/api/v1/users/507f1f77bcf86cd799439011')
                .send(changes);

            expect(response.status).toBe(200);
            expect(response.body.data.user).toEqual(user);
            expect(userService.updateReceptionist).toHaveBeenCalledWith(
                '507f1f77bcf86cd799439011',
                changes
            );
        });

        it('rejects empty or unexpected update fields', async () => {
            const emptyResponse = await request(app)
                .patch('/api/v1/users/507f1f77bcf86cd799439011')
                .send({});
            const unexpectedResponse = await request(app)
                .patch('/api/v1/users/507f1f77bcf86cd799439011')
                .send({ email: 'new@example.com' });

            expect(emptyResponse.status).toBe(400);
            expect(unexpectedResponse.status).toBe(400);
            expect(userService.updateReceptionist).not.toHaveBeenCalled();
        });
    });
});
