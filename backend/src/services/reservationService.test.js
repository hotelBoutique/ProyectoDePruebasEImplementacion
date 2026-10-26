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
    checkOutReservation,
    createReservation,
    getAvailableRooms,
    getPendingCheckOuts,
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

    it('lists active stays with a current settlement estimate', async () => {
        const reservation = {
            _id: 'reservation-id',
            checkInAt: new Date(Date.now() - 90 * 60 * 60 * 1000),
            nightlyRate: 100,
            roomNumber: '102',
            toObject: () => ({ _id: 'reservation-id', roomNumber: '102' })
        };
        const query = {
            sort: jest.fn().mockReturnThis(),
            populate: jest.fn().mockResolvedValue([reservation])
        };
        Reservation.find.mockReturnValue(query);

        const result = await getPendingCheckOuts();

        expect(Reservation.find).toHaveBeenCalledWith({ status: 'ocupada' });
        expect(query.sort).toHaveBeenCalledWith({ checkInAt: 1 });
        expect(query.populate).toHaveBeenCalledWith('room', 'number status');
        expect(result[0]).toMatchObject({
            _id: reservation._id,
            settlementEstimate: {
                actualNights: 4,
                nightlyRate: 100,
                roomSubtotal: 400
            }
        });
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

    it('confirms payment, stores the settlement, completes the stay, and releases the room', async () => {
        const session = createSessionMock();
        const checkInAt = new Date(Date.now() - 25 * 60 * 60 * 1000);
        const reservation = {
            _id: 'reservation-id',
            room: 'room-id',
            roomNumber: '101',
            roomType: 'Suite',
            status: 'ocupada',
            checkInAt,
            checkOut: new Date(Date.now() + 86400000),
            nightlyRate: 100
        };
        const finalized = {
            ...reservation,
            status: 'finalizada',
            checkOutAt: new Date(),
            settlement: { status: 'pagada', totalAmount: 250 }
        };
        Reservation.findById.mockReturnValue({
            session: jest.fn().mockResolvedValue(reservation)
        });
        Room.findById.mockReturnValue({
            session: jest.fn().mockResolvedValue({ _id: 'room-id', status: 'ocupada' })
        });
        Room.updateOne.mockResolvedValue({ matchedCount: 1 });
        Reservation.findOneAndUpdate.mockResolvedValue(finalized);

        await expect(checkOutReservation({
            reservationId: reservation._id,
            additionalCharges: [{ description: 'Minibar', amount: 50 }],
            paidAmount: 250,
            paymentMethod: 'tarjeta'
        })).resolves.toBe(finalized);

        expect(Room.updateOne).toHaveBeenCalledWith(
            { _id: 'room-id', status: 'ocupada' },
            {
                $set: { status: 'disponible' },
                $inc: { availabilityRevision: 1 }
            },
            { session }
        );
        expect(Reservation.findOneAndUpdate).toHaveBeenCalledWith(
            { _id: reservation._id, status: 'ocupada' },
            {
                $set: expect.objectContaining({
                    status: 'finalizada',
                    checkOutAt: expect.any(Date),
                    settlement: expect.objectContaining({
                        status: 'pagada',
                        actualNights: 2,
                        nightlyRate: 100,
                        roomSubtotal: 200,
                        additionalCharges: [{ description: 'Minibar', amount: 50 }],
                        additionalChargesTotal: 50,
                        totalAmount: 250,
                        paidAmount: 250,
                        paymentMethod: 'tarjeta',
                        paidAt: expect.any(Date)
                    })
                })
            },
            expect.objectContaining({ new: true, runValidators: true, session })
        );
        expect(session.endSession).toHaveBeenCalled();
    });

    it.each([
        ['payment below balance', 199, 'saldo pendiente de 1.00'],
        ['payment over balance', 201, 'supera el total de la liquidación en 1.00']
    ])('does not check out when there is a %s', async (scenario, paidAmount, message) => {
        createSessionMock();
        Reservation.findById.mockReturnValue({
            session: jest.fn().mockResolvedValue({
                _id: 'reservation-id',
                room: 'room-id',
                status: 'ocupada',
                checkInAt: new Date(Date.now() - 60 * 60 * 1000),
                checkOut: new Date(Date.now() + 86400000),
                nightlyRate: 200
            })
        });
        Room.findById.mockReturnValue({
            session: jest.fn().mockResolvedValue({ _id: 'room-id', status: 'ocupada' })
        });

        await expect(checkOutReservation({
            reservationId: 'reservation-id',
            paidAmount,
            paymentMethod: 'efectivo'
        })).rejects.toMatchObject({
            statusCode: 400,
            message: expect.stringContaining(message)
        });

        expect(Room.updateOne).not.toHaveBeenCalled();
        expect(Reservation.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it.each([
        ['cancelled stay', { status: 'cancelada' }, null, 'reservación está cancelada'],
        ['reservation without active check-in', { status: 'reservada' }, null, 'no tiene un check-in activo'],
        ['already finalized stay', { status: 'finalizada' }, null, 'ya fue finalizada'],
        ['inconsistent scheduled checkout', { checkOut: new Date('2000-01-01T00:00:00.000Z') }, null, 'fecha programada de salida no es válida'],
        ['room not occupied', { status: 'ocupada' }, { status: 'disponible' }, 'no está ocupada']
    ])('rejects check-out for %s without releasing the room', async (scenario, reservationOverrides, room, message) => {
        createSessionMock();
        Reservation.findById.mockReturnValue({
            session: jest.fn().mockResolvedValue({
                _id: 'reservation-id',
                room: 'room-id',
                status: 'ocupada',
                checkInAt: new Date(Date.now() - 60 * 60 * 1000),
                checkOut: new Date(Date.now() + 86400000),
                nightlyRate: 200,
                ...reservationOverrides
            })
        });
        if (room) {
            Room.findById.mockReturnValue({
                session: jest.fn().mockResolvedValue({ _id: 'room-id', ...room })
            });
        }

        await expect(checkOutReservation({
            reservationId: 'reservation-id',
            paidAmount: 200,
            paymentMethod: 'efectivo'
        })).rejects.toMatchObject({
            statusCode: 409,
            message: expect.stringContaining(message)
        });
        expect(Room.updateOne).not.toHaveBeenCalled();
        expect(Reservation.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it('rejects invalid additional charges and payment methods', async () => {
        await expect(checkOutReservation({
            reservationId: 'reservation-id',
            additionalCharges: [{ description: 'x', amount: 20 }],
            paidAmount: 220,
            paymentMethod: 'efectivo'
        })).rejects.toMatchObject({ statusCode: 400 });

        await expect(checkOutReservation({
            reservationId: 'reservation-id',
            paidAmount: 200,
            paymentMethod: 'cheque'
        })).rejects.toMatchObject({ statusCode: 400 });
        expect(mongoose.startSession).not.toHaveBeenCalled();
    });

    it('returns a clear error when checkout transactions are unavailable', async () => {
        const session = createSessionMock();
        session.withTransaction.mockRejectedValue(
            Object.assign(new Error('Transaction numbers are only allowed on a replica set member or mongos'), {
                code: 20
            })
        );

        await expect(checkOutReservation({
            reservationId: 'reservation-id',
            paidAmount: 100,
            paymentMethod: 'efectivo'
        })).rejects.toMatchObject({
            statusCode: 503,
            message: expect.stringContaining('MongoDB debe ejecutarse como replica set')
        });
        expect(session.endSession).toHaveBeenCalled();
    });
});
