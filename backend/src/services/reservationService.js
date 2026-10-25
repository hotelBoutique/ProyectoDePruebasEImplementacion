const mongoose = require('mongoose');

const Reservation = require('../models/reservation');
const Room = require('../models/room');
const AppError = require('../utils/AppError');
const { getDateRange } = require('../utils/reservationDates');

const ACTIVE_RESERVATION_STATUSES = ['reservada', 'ocupada'];
const UNAVAILABLE_ROOM_STATUSES = ['ocupada', 'mantenimiento', 'fuera de servicio'];

const getAvailableRooms = async (checkInValue, checkOutValue, roomId) => {
    const { checkIn, checkOut } = getDateRange(checkInValue, checkOutValue);
    const roomFilter = {
        status: { $nin: UNAVAILABLE_ROOM_STATUSES }
    };

    if (roomId) {
        roomFilter._id = roomId;
    }

    const rooms = await Room.find(roomFilter).sort({ number: 1 });

    if (!rooms.length) {
        return [];
    }

    const conflicts = await Reservation.find({
        room: { $in: rooms.map(room => room._id) },
        status: { $in: ACTIVE_RESERVATION_STATUSES },
        checkIn: { $lt: checkOut },
        checkOut: { $gt: checkIn }
    }).select('room');

    const reservedRoomIds = new Set(
        conflicts.map(reservation => String(reservation.room))
    );

    return rooms.filter(room => !reservedRoomIds.has(String(room._id)));
};

const createReservation = async ({
    guest,
    roomId,
    checkIn: checkInValue,
    checkOut: checkOutValue,
    nightlyRate,
    createdBy
}) => {
    const { checkIn, checkOut, nights } = getDateRange(checkInValue, checkOutValue);
    const hasRate = typeof nightlyRate === 'number'
        || (typeof nightlyRate === 'string' && nightlyRate.trim() !== '');
    const rate = hasRate ? Number(nightlyRate) : Number.NaN;

    if (!Number.isFinite(rate) || rate < 0) {
        throw new AppError('La tarifa aplicada debe ser un número mayor o igual a 0', 400);
    }

    const totalInCents = Math.round(rate * nights * 100);
    if (!Number.isSafeInteger(totalInCents)) {
        throw new AppError('El total de la reservación supera el límite permitido', 400);
    }

    const session = await mongoose.startSession();
    let reservation;

    try {
        await session.withTransaction(async () => {
            const room = await Room.findById(roomId).session(session);

            if (!room) {
                throw new AppError('La habitación seleccionada no existe', 404);
            }

            if (UNAVAILABLE_ROOM_STATUSES.includes(room.status)) {
                throw new AppError('La habitación no está disponible para el periodo seleccionado', 409);
            }

            const roomLock = await Room.updateOne(
                { _id: room._id, status: room.status },
                { $inc: { availabilityRevision: 1 } },
                { session }
            );

            if (roomLock.matchedCount === 0) {
                throw new AppError('La habitación no está disponible para el periodo seleccionado', 409);
            }

            const existingConflict = await Reservation.findOne({
                room: room._id,
                status: { $in: ACTIVE_RESERVATION_STATUSES },
                checkIn: { $lt: checkOut },
                checkOut: { $gt: checkIn }
            }).session(session);

            if (existingConflict) {
                throw new AppError('La habitación no está disponible para el periodo seleccionado', 409);
            }

            const [createdReservation] = await Reservation.create(
                [{
                    guest,
                    room: room._id,
                    roomNumber: room.number,
                    roomType: room.type,
                    checkIn,
                    checkOut,
                    nights,
                    nightlyRate: rate,
                    totalAmount: totalInCents / 100,
                    status: 'reservada',
                    createdBy
                }],
                { session }
            );

            reservation = createdReservation;
        });

        return reservation;
    } catch (error) {
        if (
            error.code === 20
            && /transaction|replica set|mongos/i.test(error.message || '')
        ) {
            throw new AppError(
                'MongoDB debe ejecutarse como replica set para confirmar reservaciones de forma segura',
                503
            );
        }

        throw error;
    } finally {
        await session.endSession();
    }
};

module.exports = {
    getAvailableRooms,
    createReservation
};
