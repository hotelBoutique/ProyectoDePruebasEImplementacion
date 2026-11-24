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
const Product = require('../models/product');
const Reservation = require('../models/reservation');
const { ROLES } = require('../constants/roles');

const PASSWORD = 'Integration-Test-Password-123';
const runId = randomUUID().replace(/-/g, '');
const adminEmail = `it-${runId}-admin@example.test`;
const receptionistEmail = `it-${runId}-receptionist@example.test`;
const guestEmail = `it-${runId}-guest@example.test`;
const roomNumber = `IT-${runId.slice(0, 16)}`;
const productName = `IT ${runId.slice(0, 20)} minibar`;

let admin;
let receptionist;
let room;
let product;
const createdReservationIds = [];

const stayDates = () => {
    const checkIn = new Date();
    const checkOut = new Date(checkIn);
    checkOut.setUTCDate(checkOut.getUTCDate() + 1);

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

const guest = {
    fullName: 'Huésped de integración de pagos',
    email: guestEmail,
    phone: '3001234567',
    identification: `ID-${runId.slice(0, 12)}`
};

describe('integración API y MongoDB: consumos, liquidación y pago', () => {
    beforeAll(async () => {
        await mongoose.connect(process.env.MONGODB_URI, {
            serverSelectionTimeoutMS: 10000,
            runtimeAdapters: { os }
        });
        await Promise.all([User.init(), Room.init(), Product.init(), Reservation.init()]);

        [admin, receptionist] = await User.create([
            {
                name: 'Administrador de integración de pagos',
                email: adminEmail,
                password: PASSWORD,
                role: ROLES.ADMIN
            },
            {
                name: 'Recepcionista de integración de pagos',
                email: receptionistEmail,
                password: PASSWORD,
                role: ROLES.RECEPCIONISTA
            }
        ]);

        [room, product] = await Promise.all([
            Room.create({
                number: roomNumber,
                type: 'Doble',
                description: 'Habitación aislada para integración de pagos',
                capacity: 2,
                price: 120000,
                status: 'disponible'
            }),
            Product.create({
                name: productName,
                description: 'Producto aislado para integración',
                category: 'Bebidas',
                price: 3500,
                stock: 5,
                isActive: true
            })
        ]);
    });

    afterAll(async () => {
        if (mongoose.connection.readyState === 1) {
            if (createdReservationIds.length) {
                await Reservation.deleteMany({ _id: { $in: createdReservationIds } });
            }
            await User.deleteMany({ email: { $in: [adminEmail, receptionistEmail] } });
            if (room?._id) await Room.deleteOne({ _id: room._id });
            if (product?._id) await Product.deleteOne({ _id: product._id });
        }
        await mongoose.disconnect();
    });

    it('registra consumos, corrige y anula cargos, liquida, paga y emite el comprobante', async () => {
        const adminToken = await login(adminEmail);
        const receptionistToken = await login(receptionistEmail);
        const dates = stayDates();
        const headers = { Authorization: `Bearer ${receptionistToken}` };

        const created = await request(app)
            .post('/api/v1/reservations')
            .set('Authorization', `Bearer ${receptionistToken}`)
            .send({
                guest,
                roomId: room._id.toString(),
                ...dates,
                nightlyRate: room.price
            });

        expect(created.status).toBe(201);
        const reservationId = created.body.data.reservation._id;
        createdReservationIds.push(reservationId);

        const invalidConsumption = await request(app)
            .post(`/api/v1/reservations/${reservationId}/consumptions`)
            .set(headers)
            .send({ description: 'Lavandería', quantity: 0, unitPrice: 3000 });
        expect(invalidConsumption.status).toBe(400);

        const prematureConsumption = await request(app)
            .post(`/api/v1/reservations/${reservationId}/consumptions`)
            .set(headers)
            .send({ description: 'Lavandería', quantity: 1, unitPrice: 3000 });
        expect(prematureConsumption.status).toBe(409);

        const prematureCheckout = await request(app)
            .post(`/api/v1/reservations/${reservationId}/check-out`)
            .set(headers)
            .send({ paidAmount: 0, paymentMethod: 'efectivo' });
        expect(prematureCheckout.status).toBe(409);

        const checkedIn = await request(app)
            .post(`/api/v1/reservations/${reservationId}/check-in`)
            .set(headers);
        expect(checkedIn.status).toBe(200);
        expect(checkedIn.body.data.reservation.status).toBe('ocupada');

        const catalogConsumption = await request(app)
            .post(`/api/v1/reservations/${reservationId}/consumptions`)
            .set(headers)
            .send({ productId: product._id.toString(), quantity: 2 });
        expect(catalogConsumption.status).toBe(201);
        expect(catalogConsumption.body.data.reservation.consumptions).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    description: productName,
                    quantity: 2,
                    unitPrice: 3500,
                    subtotal: 7000,
                    status: 'registrado'
                })
            ])
        );

        const manualConsumption = await request(app)
            .post(`/api/v1/reservations/${reservationId}/consumptions`)
            .set(headers)
            .send({ description: 'Room service', quantity: 1, unitPrice: 3000 });
        const manualItem = manualConsumption.body.data.reservation.consumptions.find(
            item => item.description === 'Room service'
        );
        expect(manualConsumption.status).toBe(201);

        const corrected = await request(app)
            .patch(`/api/v1/reservations/${reservationId}/consumptions/${manualItem._id}`)
            .set(headers)
            .send({ description: 'Room service corregido', quantity: 2, unitPrice: 4000 });
        expect(corrected.status).toBe(200);
        expect(corrected.body.data.reservation.consumptions).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    _id: manualItem._id,
                    description: 'Room service corregido',
                    quantity: 2,
                    unitPrice: 4000,
                    subtotal: 8000
                })
            ])
        );

        const voidedConsumption = await request(app)
            .post(`/api/v1/reservations/${reservationId}/consumptions`)
            .set(headers)
            .send({ description: 'Cargo duplicado', quantity: 1, unitPrice: 9999 });
        const voidedItem = voidedConsumption.body.data.reservation.consumptions.find(
            item => item.description === 'Cargo duplicado'
        );
        expect(voidedConsumption.status).toBe(201);

        const voided = await request(app)
            .post(`/api/v1/reservations/${reservationId}/consumptions/${voidedItem._id}/void`)
            .set(headers)
            .send({ reason: 'Cargo duplicado' });
        expect(voided.status).toBe(200);
        expect(voided.body.data.reservation.consumptions).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    _id: voidedItem._id,
                    status: 'anulado',
                    voidReason: 'Cargo duplicado',
                    voidedBy: receptionist._id.toString()
                })
            ])
        );

        const checkOutList = await request(app)
            .get('/api/v1/reservations/check-outs/pending')
            .set(headers);
        expect(checkOutList.status).toBe(200);
        const estimate = checkOutList.body.data.reservations.find(
            item => item._id === reservationId
        ).settlementEstimate;
        expect(estimate).toMatchObject({
            nightlyRate: 120000,
            consumptionsTotal: 15000,
            totalDue: 135000
        });

        const underpayment = await request(app)
            .post(`/api/v1/reservations/${reservationId}/check-out`)
            .set(headers)
            .send({ paidAmount: estimate.totalDue - 1, paymentMethod: 'tarjeta' });
        expect(underpayment.status).toBe(400);

        const checkedOut = await request(app)
            .post(`/api/v1/reservations/${reservationId}/check-out`)
            .set(headers)
            .send({ paidAmount: estimate.totalDue, paymentMethod: 'tarjeta' });
        expect(checkedOut.status).toBe(200);
        expect(checkedOut.body.data.reservation).toMatchObject({
            _id: reservationId,
            status: 'finalizada',
            settlement: {
                status: 'pagada',
                consumptionsTotal: 15000,
                totalAmount: estimate.totalDue,
                paidAmount: estimate.totalDue,
                paymentMethod: 'tarjeta'
            }
        });

        const payment = await request(app)
            .get(`/api/v1/reservations/payments/${reservationId}`)
            .set('Authorization', `Bearer ${adminToken}`);
        expect(payment.status).toBe(200);
        expect(payment.body.data.payment.settlement).toMatchObject({
            totalAmount: estimate.totalDue,
            paidAmount: estimate.totalDue,
            status: 'pagada'
        });

        const receipt = await request(app)
            .get(`/api/v1/reservations/${reservationId}/receipt`)
            .set(headers);
        expect(receipt.status).toBe(200);
        expect(receipt.body.data.receipt).toMatchObject({
            reservationId,
            totals: {
                consumptions: 15000,
                total: estimate.totalDue,
                paid: estimate.totalDue
            },
            paymentMethod: 'tarjeta'
        });
        expect(receipt.body.data.receipt.lines).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    category: 'Consumo',
                    description: productName,
                    quantity: 2,
                    subtotal: 7000
                }),
                expect.objectContaining({
                    category: 'Consumo',
                    description: 'Room service corregido',
                    quantity: 2,
                    subtotal: 8000
                })
            ])
        );
        expect(receipt.body.data.receipt.lines).not.toEqual(
            expect.arrayContaining([
                expect.objectContaining({ description: 'Cargo duplicado' })
            ])
        );

        const [storedReservation, storedProduct, storedRoom] = await Promise.all([
            Reservation.findById(reservationId),
            Product.findById(product._id),
            Room.findById(room._id)
        ]);
        expect(storedReservation.settlement).toMatchObject({
            status: 'pagada',
            totalAmount: estimate.totalDue,
            paidAmount: estimate.totalDue,
            consumptionsTotal: 15000,
            receiptNumber: receipt.body.data.receipt.receiptNumber
        });
        expect(storedReservation.settlement.consumptions).toHaveLength(2);
        expect(storedReservation.consumptions.find(item => item._id.equals(voidedItem._id)).status)
            .toBe('anulado');
        expect(storedProduct.stock).toBe(3);
        expect(storedRoom.status).toBe('disponible');
    });
});
