const { randomUUID } = require('crypto');
const os = require('os');
const mongoose = require('mongoose');
const request = require('supertest');

jest.mock('../utils/logger', () => ({
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn()
}));

const app = require('../app');
const User = require('../models/user');
const Room = require('../models/room');
const Reservation = require('../models/reservation');
const { ROLES } = require('../constants/roles');

const PASSWORD = 'Integration-Test-Password-123';
const runId = randomUUID().replace(/-/g, '');
const emailFor = suffix => `it-${runId}-${suffix}@example.test`;
const adminEmail = emailFor('admin');
const receptionistEmail = emailFor('receptionist');
const createdReceptionistEmail = emailFor('created-receptionist');
const roomNumber = `IT-${runId.slice(0, 16)}`;
const guestEmails = [emailFor('guest'), emailFor('overlap-guest')];

let admin;
let receptionist;
let room;

const futureStay = () => {
    const checkIn = new Date();
    checkIn.setUTCDate(checkIn.getUTCDate() + 2);
    const checkOut = new Date(checkIn);
    checkOut.setUTCDate(checkOut.getUTCDate() + 2);

    return {
        checkIn: checkIn.toISOString().slice(0, 10),
        checkOut: checkOut.toISOString().slice(0, 10)
    };
};

const login = async email => {
    const response = await request(app)
        .post('/api/v1/auth/login')
        .send({ email, password: PASSWORD });

    expect(response.status).toBe(200);
    expect(response.body.data.token).toEqual(expect.any(String));
    return response.body.data.token;
};

const guestFor = email => ({
    fullName: 'Huésped de integración',
    email,
    phone: '3001234567',
    identification: `ID-${runId.slice(0, 12)}`
});

describe('integración API y MongoDB: usuarios y reservas', () => {
    beforeAll(async () => {
        await mongoose.connect(process.env.MONGODB_URI, {
            serverSelectionTimeoutMS: 10000,
            // MongoDB Node driver 7.6 needs the OS adapter supplied inside Jest's VM.
            runtimeAdapters: { os }
        });
        await Promise.all([User.init(), Room.init(), Reservation.init()]);

        [admin, receptionist] = await User.create([
            {
                name: 'Administrador de integración',
                email: adminEmail,
                password: PASSWORD,
                role: ROLES.ADMIN
            },
            {
                name: 'Recepcionista de integración',
                email: receptionistEmail,
                password: PASSWORD,
                role: ROLES.RECEPCIONISTA
            }
        ]);

        room = await Room.create({
            number: roomNumber,
            type: 'Doble',
            description: 'Habitación aislada para integración',
            capacity: 2,
            price: 120000,
            status: 'disponible'
        });
    });

    afterAll(async () => {
        if (mongoose.connection.readyState === 1) {
            await Reservation.deleteMany({ 'guest.email': { $in: guestEmails } });
            await User.deleteMany({
                email: { $in: [adminEmail, receptionistEmail, createdReceptionistEmail] }
            });
            if (room?._id) {
                await Room.deleteOne({ _id: room._id });
            }
        }
        await mongoose.disconnect();
    });

    it('autentica usuarios, consulta el perfil y rechaza credenciales o tokens ausentes', async () => {
        const invalidLogin = await request(app)
            .post('/api/v1/auth/login')
            .send({ email: adminEmail, password: 'incorrecta' });
        expect(invalidLogin.status).toBe(401);

        const adminToken = await login(adminEmail);
        const profile = await request(app)
            .get('/api/v1/auth/me')
            .set('Authorization', `Bearer ${adminToken}`);

        expect(profile.status).toBe(200);
        expect(profile.body.data.user).toMatchObject({
            _id: admin._id.toString(),
            email: adminEmail,
            role: ROLES.ADMIN
        });

        const protectedRoute = await request(app).get('/api/v1/users');
        expect(protectedRoute.status).toBe(401);
    });

    it('permite al administrador crear/listar recepcionistas y deniega esas operaciones a recepción', async () => {
        const adminToken = await login(adminEmail);
        const created = await request(app)
            .post('/api/v1/users')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
                name: 'Recepcionista creada por API',
                email: createdReceptionistEmail,
                password: PASSWORD
            });

        expect(created.status).toBe(201);
        expect(created.body.data.user).toMatchObject({
            email: createdReceptionistEmail,
            role: ROLES.RECEPCIONISTA,
            isActive: true
        });
        expect(created.body.data.user).not.toHaveProperty('password');

        const storedUser = await User.findById(created.body.data.user._id).select('+password');
        expect(storedUser.role).toBe(ROLES.RECEPCIONISTA);
        expect(storedUser.password).not.toBe(PASSWORD);
        await expect(storedUser.correctPassword(PASSWORD, storedUser.password)).resolves.toBe(true);

        const list = await request(app)
            .get('/api/v1/users')
            .set('Authorization', `Bearer ${adminToken}`);
        expect(list.status).toBe(200);
        expect(list.body.data.users).toEqual(expect.arrayContaining([
            expect.objectContaining({ email: createdReceptionistEmail })
        ]));

        const receptionistToken = await login(receptionistEmail);
        const denied = await request(app)
            .get('/api/v1/users')
            .set('Authorization', `Bearer ${receptionistToken}`);
        expect(denied.status).toBe(403);
    });

    it('permite a recepción reservar por API, persiste los datos y bloquea reservas solapadas o de ADMIN', async () => {
        const dates = futureStay();
        const adminToken = await login(adminEmail);
        const receptionistToken = await login(receptionistEmail);
        const payload = {
            guest: guestFor(guestEmails[0]),
            roomId: room._id.toString(),
            ...dates,
            nightlyRate: 120000
        };

        const availability = await request(app)
            .get('/api/v1/reservations/availability')
            .query(dates)
            .set('Authorization', `Bearer ${receptionistToken}`);
        expect(availability.status).toBe(200);
        expect(availability.body.data.rooms).toEqual(expect.arrayContaining([
            expect.objectContaining({ _id: room._id.toString() })
        ]));

        const adminDenied = await request(app)
            .post('/api/v1/reservations')
            .set('Authorization', `Bearer ${adminToken}`)
            .send(payload);
        expect(adminDenied.status).toBe(403);

        const created = await request(app)
            .post('/api/v1/reservations')
            .set('Authorization', `Bearer ${receptionistToken}`)
            .send(payload);

        expect(created.status).toBe(201);
        expect(created.body.data.reservation).toMatchObject({
            roomNumber,
            nights: 2,
            nightlyRate: 120000,
            totalAmount: 240000,
            status: 'reservada',
            createdBy: receptionist._id.toString()
        });

        const savedReservation = await Reservation.findById(created.body.data.reservation._id);
        expect(savedReservation).not.toBeNull();
        expect(savedReservation.guest.email).toBe(guestEmails[0]);
        expect(savedReservation.room.toString()).toBe(room._id.toString());
        expect(savedReservation.createdBy.toString()).toBe(receptionist._id.toString());

        const readBack = await request(app)
            .get(`/api/v1/reservations/${savedReservation._id}`)
            .set('Authorization', `Bearer ${receptionistToken}`);
        expect(readBack.status).toBe(200);
        expect(readBack.body.data.reservation._id).toBe(savedReservation._id.toString());

        const overlapping = await request(app)
            .post('/api/v1/reservations')
            .set('Authorization', `Bearer ${receptionistToken}`)
            .send({ ...payload, guest: guestFor(guestEmails[1]) });
        expect(overlapping.status).toBe(409);
        expect(await Reservation.countDocuments({ 'guest.email': { $in: guestEmails } })).toBe(1);

        const availabilityAfterBooking = await request(app)
            .get('/api/v1/reservations/availability')
            .query(dates)
            .set('Authorization', `Bearer ${receptionistToken}`);
        expect(availabilityAfterBooking.status).toBe(200);
        expect(availabilityAfterBooking.body.data.rooms).not.toEqual(expect.arrayContaining([
            expect.objectContaining({ _id: room._id.toString() })
        ]));
    });
});
