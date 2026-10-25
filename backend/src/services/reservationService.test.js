jest.mock('mongoose', () => ({
    startSession: jest.fn()
}));

jest.mock('../models/reservation', () => ({
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn()
}));

jest.mock('../models/room', () => ({
    find: jest.fn(),
    findById: jest.fn(),
    updateOne: jest.fn()
}));

const mongoose = require('mongoose');
const Reservation = require('../models/reservation');
const Room = require('../models/room');
const AppError = require('../utils/AppError');
const reservationService = require('./reservationService');

const createSession = () => {
    const session = {
        withTransaction: jest.fn(async callback => callback()),
        endSession: jest.fn().mockResolvedValue(undefined)
    };
    mongoose.startSession.mockResolvedValue(session);
    return session;
};

describe('reservationService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('getAvailableRooms', () => {
        it('excludes rooms with an overlapping active reservation', async () => {
            const availableRoom = { _id: 'available-room' };
            const reservedRoom = { _id: 'reserved-room' };
            Room.find.mockReturnValue({
                sort: jest.fn().mockResolvedValue([availableRoom, reservedRoom])
            });
            Reservation.find.mockReturnValue({
                select: jest.fn().mockResolvedValue([{ room: 'reserved-room' }])
            });

            await expect(reservationService.getAvailableRooms(
                '2026-11-01',
                '2026-11-03'
            )).resolves.toEqual([availableRoom]);

            expect(Reservation.find).toHaveBeenCalledWith(expect.objectContaining({
                status: { $in: ['reservada', 'ocupada'] },
                checkIn: { $lt: new Date('2026-11-03T00:00:00.000Z') },
                checkOut: { $gt: new Date('2026-11-01T00:00:00.000Z') }
            }));
        });

        it('rejects invalid or reversed date ranges', async () => {
            await expect(reservationService.getAvailableRooms(
                '2026-02-30',
                '2026-03-02'
            )).rejects.toMatchObject({
                message: 'El check-in no es una fecha válida',
                statusCode: 400
            });

            await expect(reservationService.getAvailableRooms(
                '2026-11-03',
                '2026-11-01'
            )).rejects.toMatchObject({
                message: 'El check-out debe ser posterior al check-in',
                statusCode: 400
            });
        });
    });

    describe('createReservation', () => {
        const reservationInput = {
            guest: {
                fullName: 'Ada Lovelace',
                email: 'ada@example.com',
                phone: '3001234567',
                identification: 'CC123456'
            },
            roomId: 'room-id',
            checkIn: '2026-11-01',
            checkOut: '2026-11-03',
            nightlyRate: 150,
            createdBy: 'user-id'
        };

        it('persists the reservation and rate snapshot in one transaction', async () => {
            const room = { _id: 'room-id', number: '101', type: 'Suite', status: 'disponible' };
            const reservation = { _id: 'reservation-id', totalAmount: 300 };
            const session = createSession();
            Room.findById.mockReturnValue({ session: jest.fn().mockResolvedValue(room) });
            Room.updateOne.mockResolvedValue({ modifiedCount: 1 });
            Reservation.findOne.mockReturnValue({ session: jest.fn().mockResolvedValue(null) });
            Reservation.create.mockResolvedValue([reservation]);

            await expect(reservationService.createReservation(reservationInput))
                .resolves.toBe(reservation);

            expect(session.withTransaction).toHaveBeenCalledTimes(1);
            expect(Room.updateOne).toHaveBeenCalledWith(
                { _id: 'room-id' },
                { $inc: { availabilityRevision: 1 } },
                { session }
            );
            expect(Reservation.create).toHaveBeenCalledWith([expect.objectContaining({
                room: 'room-id',
                checkIn: new Date('2026-11-01T00:00:00.000Z'),
                checkOut: new Date('2026-11-03T00:00:00.000Z'),
                nights: 2,
                nightlyRate: 150,
                totalAmount: 300,
                status: 'reservada'
            })], { session });
            expect(session.endSession).toHaveBeenCalled();
        });

        it('does not create a reservation for an unavailable room', async () => {
            const session = createSession();
            Room.findById.mockReturnValue({
                session: jest.fn().mockResolvedValue({
                    _id: 'room-id',
                    status: 'fuera de servicio'
                })
            });

            await expect(reservationService.createReservation(reservationInput))
                .rejects.toMatchObject({
                    message: 'La habitación está fuera de servicio y no se puede reservar',
                    statusCode: 409
                });

            expect(Reservation.create).not.toHaveBeenCalled();
            expect(session.endSession).toHaveBeenCalled();
        });

        it('rolls back when the selected dates overlap another reservation', async () => {
            const session = createSession();
            Room.findById.mockReturnValue({
                session: jest.fn().mockResolvedValue({
                    _id: 'room-id',
                    status: 'disponible'
                })
            });
            Room.updateOne.mockResolvedValue({ modifiedCount: 1 });
            Reservation.findOne.mockReturnValue({
                session: jest.fn().mockResolvedValue({ _id: 'existing-reservation' })
            });

            await expect(reservationService.createReservation(reservationInput))
                .rejects.toMatchObject({
                    message: 'La habitación ya tiene una reservación en el rango de fechas seleccionado',
                    statusCode: 409
                });

            expect(Reservation.create).not.toHaveBeenCalled();
            expect(session.endSession).toHaveBeenCalled();
        });

        it('rejects an invalid tariff before starting a transaction', async () => {
            const session = createSession();

            await expect(reservationService.createReservation({
                ...reservationInput,
                nightlyRate: -1
            })).rejects.toBeInstanceOf(AppError);

            expect(mongoose.startSession).not.toHaveBeenCalled();
            expect(session.endSession).not.toHaveBeenCalled();
        });

        it('rejects a total that cannot be safely represented as a currency amount', async () => {
            createSession();
            Room.findById.mockReturnValue({
                session: jest.fn().mockResolvedValue({
                    _id: 'room-id',
                    number: '101',
                    type: 'Suite',
                    status: 'disponible'
                })
            });
            Room.updateOne.mockResolvedValue({ modifiedCount: 1 });
            Reservation.findOne.mockReturnValue({ session: jest.fn().mockResolvedValue(null) });

            await expect(reservationService.createReservation({
                ...reservationInput,
                nightlyRate: Number.MAX_VALUE
            })).rejects.toMatchObject({
                message: 'El total de la reservación supera el límite permitido',
                statusCode: 400
            });

            expect(Reservation.create).not.toHaveBeenCalled();
        });
    });
});
