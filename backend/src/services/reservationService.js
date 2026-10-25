const mongoose = require('mongoose');

const Reservation = require('../models/reservation');
const Room = require('../models/room');
const AppError = require('../utils/AppError');

const ACTIVE_STATUSES = ['reservada', 'ocupada'];
const UNAVAILABLE_ROOM_STATUSES = ['ocupada', 'mantenimiento', 'fuera de servicio'];
const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;

const parseDate = (value, fieldName) => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        throw new AppError(`${fieldName} debe tener el formato AAAA-MM-DD`, 400);
    }

    const date = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
        throw new AppError(`${fieldName} no es una fecha válida`, 400);
    }

    return date;
};

const getDateRange = (checkInValue, checkOutValue) => {
    const checkIn = parseDate(checkInValue, 'El check-in');
    const checkOut = parseDate(checkOutValue, 'El check-out');

    if (checkOut <= checkIn) {
        throw new AppError('El check-out debe ser posterior al check-in', 400);
    }

    return {
        checkIn,
        checkOut,
        nights: (checkOut.getTime() - checkIn.getTime()) / DAY_IN_MILLISECONDS
    };
};

const getAvailableRooms = async (checkInValue, checkOutValue) => {
    const { checkIn, checkOut } = getDateRange(checkInValue, checkOutValue);
    const rooms = await Room.find({
        status: { $nin: UNAVAILABLE_ROOM_STATUSES }
    }).sort({ number: 1 });

    if (!rooms.length) {
        return [];
    }

    const reservations = await Reservation.find({
        room: { $in: rooms.map(room => room._id) },
        status: { $in: ACTIVE_STATUSES },
        checkIn: { $lt: checkOut },
        checkOut: { $gt: checkIn }
    }).select('room');

    const reservedRoomIds = new Set(
        reservations.map(reservation => String(reservation.room))
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
    const rate = Number(nightlyRate);

    if (!Number.isFinite(rate) || rate < 0) {
        throw new AppError('La tarifa aplicada debe ser un número mayor o igual a 0', 400);
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
                throw new AppError('La habitación está fuera de servicio y no se puede reservar', 409);
            }

            await Room.updateOne(
                { _id: room._id },
                { $inc: { availabilityRevision: 1 } },
                { session }
            );

            const overlappingReservation = await Reservation.findOne({
                room: room._id,
                status: { $in: ACTIVE_STATUSES },
                checkIn: { $lt: checkOut },
                checkOut: { $gt: checkIn }
            }).session(session);

            if (overlappingReservation) {
                throw new AppError(
                    'La habitación ya tiene una reservación en el rango de fechas seleccionado',
                    409
                );
            }

            const totalInCents = Math.round(rate * nights * 100);
            if (!Number.isSafeInteger(totalInCents)) {
                throw new AppError('El total de la reservación supera el límite permitido', 400);
            }

            const totalAmount = totalInCents / 100;
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
                    totalAmount,
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
                'MongoDB debe ejecutarse como replica set para registrar reservaciones con transacción',
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
