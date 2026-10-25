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

jest.mock('mongoose', () => ({
    ...jest.requireActual('mongoose'),
    startSession: jest.fn()
}));

const mongoose = require('mongoose');
const Reservation = require('../models/reservation');
const Room = require('../models/room');
const { createReservation, getAvailableRooms } = require('./reservationService');

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
});
