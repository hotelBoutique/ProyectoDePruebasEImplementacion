const mongoose = require('mongoose');

const Reservation = require('../models/reservation');
const Room = require('../models/room');
const AppError = require('../utils/AppError');
const { getDateRange, getTodayDateOnly } = require('../utils/reservationDates');

const ACTIVE_RESERVATION_STATUSES = ['reservada', 'ocupada'];
const UNAVAILABLE_ROOM_STATUSES = [
    'ocupada',
    'mantenimiento',
    'fuera de servicio',
    'limpieza',
    'desinfeccion'
];

const getPendingCheckIns = async () => {
    const today = getTodayDateOnly();
    const tomorrow = new Date(`${today}T00:00:00.000Z`);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

    return Reservation.find({
        status: 'reservada',
        checkIn: {
            $gte: new Date(`${today}T00:00:00.000Z`),
            $lt: tomorrow
        }
    })
        .sort({ checkIn: 1 })
        .populate('room', 'number status');
};

const checkInReservation = async reservationId => {
    const session = await mongoose.startSession();
    let checkedInReservation;

    try {
        await session.withTransaction(async () => {
            const reservation = await Reservation.findById(reservationId).session(session);

            if (!reservation) {
                throw new AppError('La reservación no existe', 404);
            }

            if (reservation.status === 'cancelada') {
                throw new AppError('No se puede registrar el ingreso: la reservación está cancelada', 409);
            }

            if (reservation.status === 'ocupada') {
                throw new AppError('El ingreso de esta reservación ya fue registrado', 409);
            }

            if (reservation.status !== 'reservada') {
                throw new AppError('La reservación no está en un estado válido para registrar el ingreso', 409);
            }

            const scheduledCheckIn = reservation.checkIn.toISOString().slice(0, 10);
            const today = getTodayDateOnly();

            if (scheduledCheckIn !== today) {
                throw new AppError(
                    scheduledCheckIn > today
                        ? 'No se puede registrar el ingreso antes de la fecha programada'
                        : 'La fecha programada de ingreso ya pasó; revise la reservación antes de continuar',
                    409
                );
            }

            const room = await Room.findById(reservation.room).session(session);

            if (!room) {
                throw new AppError('La habitación asignada a la reservación ya no existe', 409);
            }

            if (
                room.status === 'mantenimiento'
                || room.status === 'fuera de servicio'
                || room.status === 'limpieza'
                || room.status === 'desinfeccion'
            ) {
                throw new AppError(
                    room.status === 'limpieza'
                        ? 'No se puede registrar el ingreso: la habitación está en limpieza'
                        : room.status === 'desinfeccion'
                            ? 'No se puede registrar el ingreso: la habitación está en desinfección'
                            : `No se puede registrar el ingreso: la habitación está ${room.status}`,
                    409
                );
            }

            if (room.status !== 'disponible') {
                throw new AppError(
                    'No se puede registrar el ingreso: la habitación no está disponible para ocupación',
                    409
                );
            }

            const checkInAt = new Date();
            const roomUpdate = await Room.updateOne(
                { _id: room._id, status: 'disponible' },
                {
                    $set: { status: 'ocupada' },
                    $inc: { availabilityRevision: 1 }
                },
                { session }
            );

            if (roomUpdate.matchedCount === 0) {
                throw new AppError(
                    'No se puede registrar el ingreso: la habitación cambió de estado, actualice e intente nuevamente',
                    409
                );
            }

            checkedInReservation = await Reservation.findOneAndUpdate(
                { _id: reservation._id, status: 'reservada' },
                {
                    $set: {
                        status: 'ocupada',
                        checkInAt
                    }
                },
                {
                    new: true,
                    runValidators: true,
                    session
                }
            );

            if (!checkedInReservation) {
                throw new AppError(
                    'La reservación cambió de estado; actualice e intente nuevamente',
                    409
                );
            }
        });

        return checkedInReservation;
    } catch (error) {
        if (
            error.code === 20
            && /transaction|replica set|mongos/i.test(error.message || '')
        ) {
            throw new AppError(
                'MongoDB debe ejecutarse como replica set para registrar el ingreso y actualizar la habitación de forma segura',
                503
            );
        }

        throw error;
    } finally {
        await session.endSession();
    }
};

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
    getPendingCheckIns,
    checkInReservation,
    getAvailableRooms,
    createReservation
};
