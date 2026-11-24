const { randomUUID } = require('crypto');
const os = require('os');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const request = require('supertest');

jest.mock('../utils/logger', () => ({
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn()
}));

const app = require('../app');
const User = require('../models/user');
const { ROLES } = require('../constants/roles');

const runId = randomUUID().replace(/-/g, '');
const adminEmail = `it-${runId}-admin@example.test`;
const receptionistEmail = `it-${runId}-reception@example.test`;
const password = 'Integration-Security-Password-123';

let admin;
let receptionist;
let adminToken;
let receptionistToken;

const login = async email => {
    const response = await request(app)
        .post('/api/v1/auth/login')
        .send({ email, password });

    expect(response.status).toBe(200);
    return response.body.data.token;
};

describe('integración API: protección de rutas, roles y errores', () => {
    beforeAll(async () => {
        await mongoose.connect(process.env.MONGODB_URI, {
            serverSelectionTimeoutMS: 10000,
            // MongoDB Node driver 7.6 needs the OS adapter supplied inside Jest's VM.
            runtimeAdapters: { os }
        });
        await User.init();

        [admin, receptionist] = await User.create([
            {
                name: 'Admin de seguridad',
                email: adminEmail,
                password,
                role: ROLES.ADMIN
            },
            {
                name: 'Recepción de seguridad',
                email: receptionistEmail,
                password,
                role: ROLES.RECEPCIONISTA
            }
        ]);

        adminToken = await login(adminEmail);
        receptionistToken = await login(receptionistEmail);
    });

    afterAll(async () => {
        if (mongoose.connection.readyState === 1) {
            await User.deleteMany({ email: { $in: [adminEmail, receptionistEmail] } });
        }
        await mongoose.disconnect();
    });

    it('rechaza rutas protegidas sin token, con JWT inválido o expirado', async () => {
        const noToken = await request(app).get('/api/v1/admin/dashboard');
        expect(noToken.status).toBe(401);
        expect(noToken.body).toEqual({
            success: false,
            message: 'Token de autenticación requerido'
        });

        const invalidToken = await request(app)
            .get('/api/v1/admin/dashboard')
            .set('Authorization', 'Bearer token-invalido');
        expect(invalidToken.status).toBe(401);
        expect(invalidToken.body).toEqual({ success: false, message: 'Token inválido' });

        const expiredToken = jwt.sign(
            { sub: admin._id.toString(), ver: 0 },
            process.env.JWT_SECRET,
            { expiresIn: -1 }
        );
        const expired = await request(app)
            .get('/api/v1/admin/dashboard')
            .set('Authorization', `Bearer ${expiredToken}`);
        expect(expired.status).toBe(401);
        expect(expired.body).toEqual({ success: false, message: 'Token expirado' });
    });

    it('aplica el rol requerido y permite a ambos roles usar las rutas compartidas', async () => {
        const adminDashboard = await request(app)
            .get('/api/v1/admin/dashboard')
            .set('Authorization', `Bearer ${adminToken}`);
        expect(adminDashboard.status).toBe(200);
        expect(adminDashboard.body.user).toMatchObject({
            _id: admin._id.toString(),
            role: ROLES.ADMIN
        });

        const receptionistDenied = await request(app)
            .get('/api/v1/admin/dashboard')
            .set('Authorization', `Bearer ${receptionistToken}`);
        expect(receptionistDenied.status).toBe(403);
        expect(receptionistDenied.body).toEqual({
            success: false,
            message: 'No tienes permisos para esta acción'
        });

        const adminRooms = await request(app)
            .get('/api/v1/rooms')
            .set('Authorization', `Bearer ${adminToken}`);
        const receptionistRooms = await request(app)
            .get('/api/v1/rooms')
            .set('Authorization', `Bearer ${receptionistToken}`);
        expect(adminRooms.status).toBe(200);
        expect(receptionistRooms.status).toBe(200);
    });

    it('devuelve respuestas HTTP controladas para rutas inexistentes y entradas inválidas', async () => {
        const missingRoute = await request(app).get('/api/v1/no-existe');
        expect(missingRoute.status).toBe(404);
        expect(missingRoute.body).toEqual({ success: false, message: 'Ruta no encontrada' });

        const invalidInput = await request(app)
            .post('/api/v1/users')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ name: 'A', email: 'correo-invalido', password: 'corta' });
        expect(invalidInput.status).toBe(400);
        expect(invalidInput.body.status).toBe('fail');
        expect(invalidInput.body.message).toBe('Datos inválidos');
        expect(invalidInput.body.errors.length).toBeGreaterThan(0);

        const duplicateEmail = await request(app)
            .post('/api/v1/users')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
                name: 'Correo duplicado',
                email: receptionistEmail,
                password
            });
        expect(duplicateEmail.status).toBe(409);
        expect(duplicateEmail.body).toEqual({
            success: false,
            message: 'El correo ya está registrado'
        });
    });
});
