jest.mock('../models/reservation', () => ({
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    findById: jest.fn(),
    findOneAndUpdate: jest.fn()
}));

jest.mock('../models/room', () => ({
    find: jest.fn(),
    findById: jest.fn(),
    updateOne: jest.fn()
}));

jest.mock('mongoose', () => ({
    ...jest.requireActual('mongoose'),
    startSession: jest.fn()
}));

const mongoose = require('mongoose');
const Reservation = require('../models/reservation');
const Room = require('../models/room');
const {
    checkInReservation,
    createReservation,
    getAvailableRooms,
    getPendingCheckIns
} = require('./reservationService');

const getFutureDates = () => {
    const checkIn = new Date();
    checkIn.setUTCDate(checkIn.getUTCDate() + 1);
    const checkOut = new Date(checkIn);
    checkOut.setUTCDate(checkOut.getUTCDate() + 2);

    return {
        checkIn: checkIn.toISOString().slice(0, 10),
        checkOut: checkOut.toISOString().slice(0, 10)
    };
};

const createSessionMock = () => {
    const session = {
        withTransaction: jest.fn(async callback => callback()),
        endSession: jest.fn()
    };
    mongoose.startSession.mockResolvedValue(session);
    return session;
};

describe('reservationService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('filters out rooms with an active overlapping reservation', async () => {
        const dates = getFutureDates();
        const available = { _id: 'available', number: '101' };
        const reserved = { _id: 'reserved', number: '102' };
        const rooms = [available, reserved];
        const conflicts = [{ room: 'reserved' }];
        Room.find.mockReturnValue({ sort: jest.fn().mockResolvedValue(rooms) });
        Reservation.find.mockReturnValue({ select: jest.fn().mockResolvedValue(conflicts) });

        await expect(getAvailableRooms(dates.checkIn, dates.checkOut)).resolves.toEqual([available]);

        expect(Reservation.find).toHaveBeenCalledWith(expect.objectContaining({
            room: { $in: ['available', 'reserved'] },
            status: { $in: ['reservada', 'ocupada'] },
            checkIn: { $lt: new Date(`${dates.checkOut}T00:00:00.000Z`) },
            checkOut: { $gt: new Date(`${dates.checkIn}T00:00:00.000Z`) }
        }));
    });

    it('returns only reservations scheduled for check-in today', async () => {
        const reservations = [{ _id: 'reservation-id' }];
        const query = {
            sort: jest.fn().mockReturnThis(),
            populate: jest.fn().mockResolvedValue(reservations)
        };
        Reservation.find.mockReturnValue(query);

        await expect(getPendingCheckIns()).resolves.toBe(reservations);

        const today = new Date().toISOString().slice(0, 10);
        const tomorrow = new Date(`${today}T00:00:00.000Z`);
        tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
        expect(Reservation.find).toHaveBeenCalledWith({
            status: 'reservada',
            checkIn: {
                $gte: new Date(`${today}T00:00:00.000Z`),
                $lt: tomorrow
            }
        });
        expect(query.populate).toHaveBeenCalledWith('room', 'number status');
    });

    it('creates a reservation atomically with a calculated total', async () => {
        const dates = getFutureDates();
        const session = createSessionMock();
        const room = {
            _id: 'room-id',
            number: '101',
            type: 'Suite',
            status: 'disponible'
        };
        const reservation = { _id: 'reservation-id' };
        Room.findById.mockReturnValue({ session: jest.fn().mockResolvedValue(room) });
        Room.updateOne.mockResolvedValue({ matchedCount: 1 });
        Reservation.findOne.mockReturnValue({ session: jest.fn().mockResolvedValue(null) });
        Reservation.create.mockResolvedValue([reservation]);

        await expect(createReservation({
            guest: { fullName: 'Ada Lovelace' },
            roomId: room._id,
            checkIn: dates.checkIn,
            checkOut: dates.checkOut,
            nightlyRate: 175,
            createdBy: 'user-id'
        })).resolves.toBe(reservation);

        expect(Room.updateOne).toHaveBeenCalledWith(
            { _id: room._id, status: 'disponible' },
            { $inc: { availabilityRevision: 1 } },
            { session }
        );
        expect(Reservation.create).toHaveBeenCalledWith([expect.objectContaining({
            room: room._id,
            roomNumber: room.number,
            checkIn: new Date(`${dates.checkIn}T00:00:00.000Z`),
            checkOut: new Date(`${dates.checkOut}T00:00:00.000Z`),
            nights: 2,
            nightlyRate: 175,
            totalAmount: 350,
            status: 'reservada'
        })], { session });
        expect(session.endSession).toHaveBeenCalled();
    });

    it('rejects an overlapping reservation without creating a record', async () => {
        const dates = getFutureDates();
        createSessionMock();
        Room.findById.mockReturnValue({
            session: jest.fn().mockResolvedValue({
                _id: 'room-id',
                status: 'disponible'
            })
        });
        Room.updateOne.mockResolvedValue({ matchedCount: 1 });
        Reservation.findOne.mockReturnValue({
            session: jest.fn().mockResolvedValue({ _id: 'existing-reservation' })
        });

        await expect(createReservation({
            guest: { fullName: 'Ada Lovelace' },
            roomId: 'room-id',
            checkIn: dates.checkIn,
            checkOut: dates.checkOut,
            nightlyRate: 175,
            createdBy: 'user-id'
        })).rejects.toMatchObject({
            statusCode: 409,
            message: 'La habitación no está disponible para el periodo seleccionado'
        });

        expect(Reservation.create).not.toHaveBeenCalled();
    });

    it('rejects rooms outside service and invalid rates', async () => {
        const dates = getFutureDates();
        createSessionMock();
        Room.findById.mockReturnValue({
            session: jest.fn().mockResolvedValue({
                _id: 'room-id',
                status: 'fuera de servicio'
            })
        });

        await expect(createReservation({
            roomId: 'room-id',
            checkIn: dates.checkIn,
            checkOut: dates.checkOut,
            nightlyRate: 10,
            createdBy: 'user-id'
        })).rejects.toMatchObject({ statusCode: 409 });
        expect(Room.updateOne).not.toHaveBeenCalled();

        await expect(createReservation({
            roomId: 'room-id',
            checkIn: dates.checkIn,
            checkOut: dates.checkOut,
            nightlyRate: -1,
            createdBy: 'user-id'
        })).rejects.toMatchObject({ statusCode: 400 });
        await expect(createReservation({
            roomId: 'room-id',
            checkIn: dates.checkIn,
            checkOut: dates.checkOut,
            nightlyRate: '',
            createdBy: 'user-id'
        })).rejects.toMatchObject({ statusCode: 400 });
    });

    it('checks in a guest and marks the room occupied in one transaction', async () => {
        const session = createSessionMock();
        const scheduledCheckIn = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);
        const reservation = {
            _id: 'reservation-id',
            room: 'room-id',
            status: 'reservada',
            checkIn: scheduledCheckIn
        };
        const checkedInReservation = {
            ...reservation,
            status: 'ocupada',
            checkInAt: new Date()
        };
        Reservation.findById.mockReturnValue({
            session: jest.fn().mockResolvedValue(reservation)
        });
        Room.findById.mockReturnValue({
            session: jest.fn().mockResolvedValue({
                _id: 'room-id',
                status: 'disponible'
            })
        });
        Room.updateOne.mockResolvedValue({ matchedCount: 1 });
        Reservation.findOneAndUpdate.mockResolvedValue(checkedInReservation);

        await expect(checkInReservation(reservation._id)).resolves.toBe(checkedInReservation);

        expect(Room.updateOne).toHaveBeenCalledWith(
            { _id: 'room-id', status: 'disponible' },
            {
                $set: { status: 'ocupada' },
                $inc: { availabilityRevision: 1 }
            },
            { session }
        );
        expect(Reservation.findOneAndUpdate).toHaveBeenCalledWith(
            { _id: reservation._id, status: 'reservada' },
            {
                $set: expect.objectContaining({
                    status: 'ocupada',
                    checkInAt: expect.any(Date)
                })
            },
            expect.objectContaining({ new: true, runValidators: true, session })
        );
        expect(session.endSession).toHaveBeenCalled();
    });

    it.each([
        ['cancelled reservation', { status: 'cancelada' }, null, 'reservación está cancelada'],
        ['already checked-in reservation', { status: 'ocupada' }, null, 'ya fue registrado'],
        ['future check-in date', { status: 'reservada', checkIn: new Date(Date.now() + 86400000) }, null, 'antes de la fecha programada'],
        ['missed check-in date', { status: 'reservada', checkIn: new Date('2000-01-01T00:00:00.000Z') }, null, 'fecha programada de ingreso ya pasó'],
        ['room in maintenance', { status: 'reservada', checkIn: new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`) }, { status: 'mantenimiento' }, 'habitación está mantenimiento'],
        ['room out of service', { status: 'reservada', checkIn: new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`) }, { status: 'fuera de servicio' }, 'habitación está fuera de servicio'],
        ['room being cleaned', { status: 'reservada', checkIn: new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`) }, { status: 'limpieza' }, 'habitación está en limpieza'],
        ['room being disinfected', { status: 'reservada', checkIn: new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`) }, { status: 'desinfeccion' }, 'habitación está en desinfección']
    ])('rejects check-in for %s without changing room state', async (scenario, reservationOverrides, room, message) => {
        createSessionMock();
        const reservation = {
            _id: 'reservation-id',
            room: 'room-id',
            status: 'reservada',
            checkIn: new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`),
            ...reservationOverrides
        };
        Reservation.findById.mockReturnValue({
            session: jest.fn().mockResolvedValue(reservation)
        });
        if (room) {
            Room.findById.mockReturnValue({ session: jest.fn().mockResolvedValue(room) });
        }

        await expect(checkInReservation(reservation._id)).rejects.toMatchObject({
            statusCode: 409,
            message: expect.stringContaining(message)
        });

        expect(Room.updateOne).not.toHaveBeenCalled();
        expect(Reservation.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it('returns a clear error when check-in transactions are not supported', async () => {
        const session = createSessionMock();
        session.withTransaction.mockRejectedValue(
            Object.assign(new Error('Transaction numbers are only allowed on a replica set member or mongos'), {
                code: 20
            })
        );

        await expect(checkInReservation('reservation-id')).rejects.toMatchObject({
            statusCode: 503,
            message: expect.stringContaining('MongoDB debe ejecutarse como replica set')
        });
        expect(session.endSession).toHaveBeenCalled();
    });
});
