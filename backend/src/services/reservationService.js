const mongoose = require('mongoose');

const Reservation = require('../models/reservation');
const Room = require('../models/room');
const Product = require('../models/product');
const AppError = require('../utils/AppError');
const { getDateRange, getTodayDateOnly, isValidDateOnly } = require('../utils/reservationDates');

const ACTIVE_RESERVATION_STATUSES = ['reservada', 'ocupada'];
const UNAVAILABLE_ROOM_STATUSES = [
    'ocupada',
    'mantenimiento',
    'fuera de servicio',
    'limpieza',
    'desinfeccion'
];
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
const PAYMENT_METHODS = ['efectivo', 'tarjeta', 'transferencia'];

const toCents = value => Math.round(value * 100);

const getStayNights = (checkInAt, checkOutAt = new Date()) => {
    const elapsed = checkOutAt.getTime() - checkInAt.getTime();

    if (!Number.isFinite(elapsed) || elapsed < 0) {
        throw new AppError('La fecha y hora de ingreso no es válida para liquidar la estancia', 409);
    }

    return Math.max(1, Math.ceil(elapsed / MILLISECONDS_PER_DAY));
};

const normalizeAdditionalCharges = charges => {
    if (!Array.isArray(charges)) {
        throw new AppError('Los cargos adicionales deben enviarse como una lista', 400);
    }

    if (charges.length > 20) {
        throw new AppError('No se permiten más de 20 cargos adicionales por liquidación', 400);
    }

    let totalCents = 0;
    const normalized = charges.map((charge, index) => {
        const description = typeof charge?.description === 'string'
            ? charge.description.trim()
            : '';
        const hasAmount = typeof charge?.amount === 'number'
            || (typeof charge?.amount === 'string' && charge.amount.trim() !== '');
        const hasUnitPrice = typeof charge?.unitPrice === 'number'
            || (typeof charge?.unitPrice === 'string' && charge.unitPrice.trim() !== '');
        const rawQuantity = charge?.quantity === undefined && hasAmount
            ? 1
            : Number(charge?.quantity);
        const rawUnitPrice = hasUnitPrice
            ? Number(charge.unitPrice)
            : hasAmount && rawQuantity === 1
                ? Number(charge.amount)
                : Number.NaN;

        if (description.length < 2 || description.length > 120) {
            throw new AppError(`El concepto del cargo ${index + 1} debe tener entre 2 y 120 caracteres`, 400);
        }

        if (!Number.isInteger(rawQuantity) || rawQuantity < 1 || rawQuantity > 1000) {
            throw new AppError(`La cantidad del cargo ${index + 1} debe ser un entero entre 1 y 1000`, 400);
        }

        if (!Number.isFinite(rawUnitPrice) || rawUnitPrice < 0) {
            throw new AppError(`El precio unitario del cargo ${index + 1} debe ser un número mayor o igual a 0`, 400);
        }

        const unitPriceCents = toCents(rawUnitPrice);
        const subtotalCents = unitPriceCents * rawQuantity;
        if (!Number.isSafeInteger(unitPriceCents) || !Number.isSafeInteger(subtotalCents)) {
            throw new AppError(`El subtotal del cargo ${index + 1} supera el límite permitido`, 400);
        }

        if (hasAmount && hasUnitPrice && toCents(Number(charge.amount)) !== subtotalCents) {
            throw new AppError(`El subtotal del cargo ${index + 1} no coincide con la cantidad y el precio unitario`, 400);
        }

        totalCents += subtotalCents;
        return {
            description,
            quantity: rawQuantity,
            unitPrice: unitPriceCents / 100,
            subtotal: subtotalCents / 100,
            amount: subtotalCents / 100
        };
    });

    if (!Number.isSafeInteger(totalCents)) {
        throw new AppError('El total de cargos adicionales supera el límite permitido', 400);
    }

    return { charges: normalized, totalCents };
};

const getStoredConsumptionsTotalCents = consumptions => {
    if (!Array.isArray(consumptions)) {
        throw new AppError('Los consumos registrados de la estancia tienen un formato inválido', 409);
    }

    return consumptions.reduce((totalCents, consumption, index) => {
        if (consumption.status === 'anulado') {
            return totalCents;
        }

        const quantity = Number(consumption.quantity);
        const unitPriceCents = toCents(Number(consumption.unitPrice));
        const subtotalCents = toCents(Number(consumption.subtotal));
        const calculatedSubtotalCents = unitPriceCents * quantity;

        if (
            typeof consumption.description !== 'string'
            || consumption.description.trim().length < 2
            || !Number.isInteger(quantity)
            || quantity < 1
            || !Number.isSafeInteger(unitPriceCents)
            || unitPriceCents < 0
            || !Number.isSafeInteger(subtotalCents)
            || subtotalCents !== calculatedSubtotalCents
        ) {
            throw new AppError(
                `El consumo ${index + 1} de la estancia tiene datos inconsistentes`,
                409
            );
        }

        const newTotal = totalCents + subtotalCents;
        if (!Number.isSafeInteger(newTotal)) {
            throw new AppError('El total de consumos supera el límite permitido', 409);
        }
        return newTotal;
    }, 0);
};

const getReservationConsumptions = async reservationId => {
    const reservation = await Reservation.findById(reservationId)
        .select('status roomNumber consumptions');

    if (!reservation) {
        throw new AppError('La reservación no existe', 404);
    }

    if (!['ocupada', 'finalizada'].includes(reservation.status)) {
        throw new AppError('Solo se pueden consultar consumos de una estancia ocupada o finalizada', 409);
    }

    const consumptions = (reservation.consumptions || []).map(item => {
        const data = item.toObject ? item.toObject() : { ...item };
        return data;
    });

    return {
        reservationId,
        roomNumber: reservation.roomNumber,
        status: reservation.status,
        consumptions,
        activeConsumptions: consumptions.filter(item => item.status !== 'anulado'),
        voidedConsumptions: consumptions.filter(item => item.status === 'anulado'),
        total: consumptions
            .filter(item => item.status !== 'anulado')
            .reduce((total, item) => total + Number(item.subtotal || 0), 0)
    };
};

const updateReservationConsumption = async (reservationId, consumptionId, changes) => {
    if (!changes || typeof changes !== 'object' || Array.isArray(changes)) {
        throw new AppError('Los datos del consumo son inválidos', 400);
    }

    const allowedFields = ['description', 'quantity', 'unitPrice'];
    const fields = Object.keys(changes);
    if (!fields.length) {
        throw new AppError('Indica al menos un dato para corregir', 400);
    }
    if (fields.some(field => !allowedFields.includes(field))) {
        throw new AppError('La solicitud contiene datos de consumo no editables', 400);
    }

    const reservation = await Reservation.findById(reservationId);
    if (!reservation) {
        throw new AppError('La reservación no existe', 404);
    }
    if (reservation.status !== 'ocupada') {
        throw new AppError('Solo se pueden corregir consumos antes de cerrar la cuenta', 409);
    }

    const consumption = reservation.consumptions.id(consumptionId);
    if (!consumption) {
        throw new AppError('El consumo no existe en esta reservación', 404);
    }
    if (consumption.status === 'anulado') {
        throw new AppError('No se puede corregir un consumo anulado', 409);
    }

    const description = changes.description === undefined
        ? consumption.description
        : changes.description.trim();
    const quantity = changes.quantity === undefined
        ? Number(consumption.quantity)
        : Number(changes.quantity);
    const unitPrice = changes.unitPrice === undefined
        ? Number(consumption.unitPrice)
        : Number(changes.unitPrice);

    if (description.length < 2 || description.length > 120) {
        throw new AppError('El concepto debe tener entre 2 y 120 caracteres', 400);
    }
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 1000) {
        throw new AppError('La cantidad debe ser un entero entre 1 y 1000', 400);
    }
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
        throw new AppError('El precio unitario debe ser un número mayor o igual a 0', 400);
    }

    const unitPriceCents = toCents(unitPrice);
    const subtotalCents = unitPriceCents * quantity;
    if (!Number.isSafeInteger(unitPriceCents) || !Number.isSafeInteger(subtotalCents)) {
        throw new AppError('El subtotal del consumo supera el límite permitido', 400);
    }

    consumption.description = description;
    consumption.quantity = quantity;
    consumption.unitPrice = unitPriceCents / 100;
    consumption.subtotal = subtotalCents / 100;
    consumption.amount = subtotalCents / 100;

    await reservation.save();
    return reservation;
};

const voidReservationConsumption = async (reservationId, consumptionId, reason, voidedBy) => {
    const normalizedReason = typeof reason === 'string' ? reason.trim() : '';
    if (normalizedReason.length < 3 || normalizedReason.length > 500) {
        throw new AppError('El motivo de anulación debe tener entre 3 y 500 caracteres', 400);
    }

    const reservation = await Reservation.findById(reservationId);
    if (!reservation) {
        throw new AppError('La reservación no existe', 404);
    }
    if (reservation.status !== 'ocupada') {
        throw new AppError('Solo se pueden anular consumos antes de cerrar la cuenta', 409);
    }

    const consumption = reservation.consumptions.id(consumptionId);
    if (!consumption) {
        throw new AppError('El consumo no existe en esta reservación', 404);
    }
    if (consumption.status === 'anulado') {
        throw new AppError('El consumo ya fue anulado', 409);
    }

    consumption.status = 'anulado';
    consumption.voidReason = normalizedReason;
    consumption.voidedAt = new Date();
    consumption.voidedBy = voidedBy;

    await reservation.save();
    return reservation;
};

const addReservationConsumption = async (reservationId, consumption) => {
    if (consumption?.productId) {
        if (!mongoose.isValidObjectId(consumption.productId)) {
            throw new AppError('El producto seleccionado no es válido', 400);
        }
        const quantity = Number(consumption.quantity);
        if (!Number.isInteger(quantity) || quantity < 1 || quantity > 1000) {
            throw new AppError('La cantidad debe ser un entero entre 1 y 1000', 400);
        }

        const session = await mongoose.startSession();
        let updatedReservation;
        try {
            await session.withTransaction(async () => {
                const reservation = await Reservation.findById(reservationId).session(session);
                if (!reservation) {
                    throw new AppError('La reservación no existe', 404);
                }
                if (reservation.status !== 'ocupada') {
                    throw new AppError('Solo se pueden registrar consumos durante una estancia activa', 409);
                }

                const product = await Product.findOne({
                    _id: consumption.productId,
                    isActive: true
                }).session(session);
                if (!product) {
                    throw new AppError('El producto no existe o está desactivado', 404);
                }
                if (!Number.isInteger(product.stock) || product.stock < quantity) {
                    throw new AppError('No hay stock suficiente para registrar este consumo', 409);
                }

                const unitPriceCents = toCents(product.price);
                const subtotalCents = unitPriceCents * quantity;
                if (!Number.isSafeInteger(unitPriceCents) || !Number.isSafeInteger(subtotalCents)) {
                    throw new AppError('El subtotal del consumo supera el límite permitido', 400);
                }

                const stockUpdate = await Product.updateOne(
                    { _id: product._id, isActive: true, stock: { $gte: quantity } },
                    { $inc: { stock: -quantity } },
                    { session }
                );
                if (stockUpdate.matchedCount === 0) {
                    throw new AppError('El stock cambió; actualice y vuelva a intentar', 409);
                }

                updatedReservation = await Reservation.findOneAndUpdate(
                    { _id: reservationId, status: 'ocupada' },
                    {
                        $push: {
                            consumptions: {
                                product: product._id,
                                description: product.name,
                                quantity,
                                unitPrice: unitPriceCents / 100,
                                subtotal: subtotalCents / 100,
                                amount: subtotalCents / 100,
                                status: 'registrado'
                            }
                        }
                    },
                    { new: true, runValidators: true, session }
                );
                if (!updatedReservation) {
                    throw new AppError('La reservación cambió de estado; actualice e intente nuevamente', 409);
                }
            });
            return updatedReservation;
        } finally {
            await session.endSession();
        }
    }

    const { charges } = normalizeAdditionalCharges([consumption]);
    charges[0].status = 'registrado';
    const updatedReservation = await Reservation.findOneAndUpdate(
        { _id: reservationId, status: 'ocupada' },
        { $push: { consumptions: charges[0] } },
        { new: true, runValidators: true }
    );

    if (updatedReservation) {
        return updatedReservation;
    }

    const reservation = await Reservation.findById(reservationId).select('status');
    if (!reservation) {
        throw new AppError('La reservación no existe', 404);
    }

    throw new AppError(
        'Solo se pueden registrar consumos durante una estancia con check-in activo',
        409
    );
};

const checkOutReservation = async ({
    reservationId,
    additionalCharges = [],
    paidAmount,
    paymentMethod
}) => {
    if (!PAYMENT_METHODS.includes(paymentMethod)) {
        throw new AppError('Selecciona un método de pago válido', 400);
    }

    const hasPaidAmount = typeof paidAmount === 'number'
        || (typeof paidAmount === 'string' && paidAmount.trim() !== '');
    const paidAmountNumber = hasPaidAmount ? Number(paidAmount) : Number.NaN;

    if (!Number.isFinite(paidAmountNumber) || paidAmountNumber < 0) {
        throw new AppError('El importe pagado debe ser un número mayor o igual a 0', 400);
    }

    const paidAmountCents = toCents(paidAmountNumber);
    if (!Number.isSafeInteger(paidAmountCents)) {
        throw new AppError('El importe pagado supera el límite permitido', 400);
    }

    const { charges, totalCents: additionalChargesCents } =
        normalizeAdditionalCharges(additionalCharges);
    const session = await mongoose.startSession();
    let finalizedReservation;

    try {
        await session.withTransaction(async () => {
            const reservation = await Reservation.findById(reservationId).session(session);

            if (!reservation) {
                throw new AppError('La reservación no existe', 404);
            }

            if (reservation.status === 'finalizada') {
                throw new AppError('La estancia ya fue finalizada y liquidada', 409);
            }

            if (reservation.status !== 'ocupada') {
                throw new AppError(
                    reservation.status === 'cancelada'
                        ? 'No se puede hacer check-out: la reservación está cancelada'
                        : 'No se puede hacer check-out: la estancia no tiene un check-in activo',
                    409
                );
            }

            if (
                !reservation.checkInAt
                || Number.isNaN(reservation.checkInAt.getTime())
                || reservation.checkInAt > new Date()
            ) {
                throw new AppError('La fecha y hora de ingreso de la estancia no es válida', 409);
            }

            if (
                !reservation.checkOut
                || Number.isNaN(reservation.checkOut.getTime())
                || reservation.checkOut <= reservation.checkInAt
            ) {
                throw new AppError('La fecha programada de salida no es válida para esta estancia', 409);
            }

            const room = await Room.findById(reservation.room).session(session);
            if (!room) {
                throw new AppError('La habitación asignada a la estancia ya no existe', 409);
            }

            if (room.status !== 'ocupada') {
                throw new AppError(
                    `No se puede finalizar la estancia: la habitación tiene estado "${room.status}" y no está ocupada`,
                    409
                );
            }

            const checkOutAt = new Date();
            const actualNights = getStayNights(reservation.checkInAt, checkOutAt);
            const roomSubtotalCents = toCents(reservation.nightlyRate) * actualNights;
            const consumptionsCents = getStoredConsumptionsTotalCents(
                reservation.consumptions || []
            );
            const totalCents = roomSubtotalCents + consumptionsCents + additionalChargesCents;

            if (!Number.isSafeInteger(totalCents)) {
                throw new AppError('El total de la liquidación supera el límite permitido', 400);
            }

            if (paidAmountCents < totalCents) {
                throw new AppError(
                    `No se puede finalizar la estancia: saldo pendiente de ${((totalCents - paidAmountCents) / 100).toFixed(2)}`,
                    400
                );
            }

            if (paidAmountCents > totalCents) {
                throw new AppError(
                    `El importe recibido supera el total de la liquidación en ${((paidAmountCents - totalCents) / 100).toFixed(2)}`,
                    400
                );
            }

            const roomUpdate = await Room.updateOne(
                { _id: room._id, status: 'ocupada' },
                {
                    $set: { status: 'disponible' },
                    $inc: { availabilityRevision: 1 }
                },
                { session }
            );

            if (roomUpdate.matchedCount === 0) {
                throw new AppError(
                    'La habitación cambió de estado; actualice e intente nuevamente',
                    409
                );
            }

            finalizedReservation = await Reservation.findOneAndUpdate(
                { _id: reservation._id, status: 'ocupada' },
                {
                    $set: {
                        status: 'finalizada',
                        checkOutAt,
                        settlement: {
                            status: 'pagada',
                            actualNights,
                            nightlyRate: reservation.nightlyRate,
                            roomSubtotal: roomSubtotalCents / 100,
                            consumptions: (reservation.consumptions || []).filter(
                                consumption => consumption.status !== 'anulado'
                            ),
                            consumptionsTotal: consumptionsCents / 100,
                            additionalCharges: charges,
                            additionalChargesTotal: additionalChargesCents / 100,
                            totalAmount: totalCents / 100,
                            paidAmount: paidAmountCents / 100,
                            paymentMethod,
                            paidAt: checkOutAt
                        }
                    }
                },
                {
                    new: true,
                    runValidators: true,
                    session
                }
            );

            if (!finalizedReservation) {
                throw new AppError(
                    'La estancia cambió de estado; actualice e intente nuevamente',
                    409
                );
            }
        });

        return finalizedReservation;
    } catch (error) {
        if (
            error.code === 20
            && /transaction|replica set|mongos/i.test(error.message || '')
        ) {
            throw new AppError(
                'MongoDB debe ejecutarse como replica set para registrar el pago y liberar la habitación de forma segura',
                503
            );
        }

        throw error;
    } finally {
        await session.endSession();
    }
};

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

const getPendingCheckOuts = async () => {
    const reservations = await Reservation.find({ status: 'ocupada' })
        .sort({ checkInAt: 1 })
        .populate('room', 'number status');
    const now = new Date();

    return reservations.map(reservation => {
        const reservationData = reservation.toObject();
        if (!reservation.checkInAt) {
            return {
                ...reservationData,
                settlementEstimate: null
            };
        }

        const actualNights = getStayNights(reservation.checkInAt, now);
        const roomSubtotalCents = toCents(reservation.nightlyRate) * actualNights;
        const consumptionsCents = getStoredConsumptionsTotalCents(
            reservation.consumptions || []
        );
        const totalDueCents = roomSubtotalCents + consumptionsCents;
        if (
            !Number.isSafeInteger(roomSubtotalCents)
            || !Number.isSafeInteger(totalDueCents)
        ) {
            throw new AppError(
                `El importe de la liquidación de la habitación ${reservation.roomNumber} supera el límite permitido`,
                400
            );
        }

        return {
            ...reservationData,
            settlementEstimate: {
                actualNights,
                nightlyRate: reservation.nightlyRate,
                roomSubtotal: roomSubtotalCents / 100,
                consumptionsTotal: consumptionsCents / 100,
                totalDue: totalDueCents / 100,
                asOf: now
            }
        };
    });
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

const updateReservation = async (reservationId, changes) => {
    if (!changes || typeof changes !== 'object' || Array.isArray(changes)) {
        throw new AppError('Los datos de la reservación son inválidos', 400);
    }

    const allowedFields = ['guest', 'roomId', 'checkIn', 'checkOut', 'nightlyRate'];
    const fields = Object.keys(changes);
    if (!fields.length) {
        throw new AppError('Indica al menos un dato para actualizar', 400);
    }

    const unexpectedFields = fields.filter(field => !allowedFields.includes(field));
    if (unexpectedFields.length) {
        throw new AppError('La solicitud contiene datos de reservación no editables', 400);
    }

    const session = await mongoose.startSession();
    let updatedReservation;

    try {
        await session.withTransaction(async () => {
            const reservation = await Reservation.findById(reservationId).session(session);

            if (!reservation) {
                throw new AppError('La reservación no existe', 404);
            }
            if (reservation.status !== 'reservada') {
                throw new AppError(
                    reservation.status === 'ocupada'
                        ? 'No se puede modificar una reservación después de registrar el check-in'
                        : `No se puede modificar una reservación en estado ${reservation.status}`,
                    409
                );
            }

            const checkInValue = changes.checkIn ?? reservation.checkIn.toISOString().slice(0, 10);
            const checkOutValue = changes.checkOut ?? reservation.checkOut.toISOString().slice(0, 10);
            const { checkIn, checkOut, nights } = getDateRange(checkInValue, checkOutValue);

            const roomId = changes.roomId ?? reservation.room.toString();
            const room = await Room.findById(roomId).session(session);
            if (!room) {
                throw new AppError('La habitación seleccionada no existe', 404);
            }
            if (UNAVAILABLE_ROOM_STATUSES.includes(room.status)) {
                throw new AppError('La habitación no está disponible para el periodo seleccionado', 409);
            }

            const conflict = await Reservation.findOne({
                _id: { $ne: reservationId },
                room: room._id,
                status: { $in: ACTIVE_RESERVATION_STATUSES },
                checkIn: { $lt: checkOut },
                checkOut: { $gt: checkIn }
            }).session(session);

            if (conflict) {
                throw new AppError('La habitación no está disponible para el periodo seleccionado', 409);
            }

            let rate = reservation.nightlyRate;
            if (changes.nightlyRate !== undefined) {
                const hasRate = typeof changes.nightlyRate === 'number'
                    || (typeof changes.nightlyRate === 'string' && changes.nightlyRate.trim() !== '');
                rate = hasRate ? Number(changes.nightlyRate) : Number.NaN;
            } else if (changes.roomId && String(changes.roomId) !== String(reservation.room)) {
                rate = room.price;
            }

            if (!Number.isFinite(rate) || rate < 0) {
                throw new AppError('La tarifa aplicada debe ser un número mayor o igual a 0', 400);
            }

            const totalInCents = Math.round(rate * nights * 100);
            if (!Number.isSafeInteger(totalInCents)) {
                throw new AppError('El total de la reservación supera el límite permitido', 400);
            }

            let guestChanges = {};
            if (changes.guest !== undefined) {
                if (!changes.guest || typeof changes.guest !== 'object' || Array.isArray(changes.guest)) {
                    throw new AppError('Los datos del huésped deben ser un objeto', 400);
                }

                guestChanges = changes.guest;
                const guestFields = ['fullName', 'email', 'phone', 'identification'];
                const guestUpdateFields = Object.keys(guestChanges);
                if (!guestUpdateFields.length) {
                    throw new AppError('Indica al menos un dato del huésped para actualizar', 400);
                }
                if (guestUpdateFields.some(field => !guestFields.includes(field))) {
                    throw new AppError('La solicitud contiene datos del huésped no editables', 400);
                }
            }

            const guest = {
                fullName: guestChanges.fullName ?? reservation.guest.fullName,
                email: guestChanges.email ?? reservation.guest.email,
                phone: guestChanges.phone ?? reservation.guest.phone,
                identification: guestChanges.identification ?? reservation.guest.identification
            };

            updatedReservation = await Reservation.findOneAndUpdate(
                { _id: reservationId, status: 'reservada' },
                {
                    $set: {
                        guest,
                        room: room._id,
                        roomNumber: room.number,
                        roomType: room.type,
                        checkIn,
                        checkOut,
                        nights,
                        nightlyRate: rate,
                        totalAmount: totalInCents / 100
                    }
                },
                { new: true, runValidators: true, session }
            );

            if (!updatedReservation) {
                throw new AppError('La reservación cambió de estado; actualice e intente nuevamente', 409);
            }

            if (String(room._id) !== String(reservation.room)) {
                const roomLock = await Room.updateOne(
                    { _id: room._id, status: room.status },
                    { $inc: { availabilityRevision: 1 } },
                    { session }
                );
                if (roomLock.matchedCount === 0) {
                    throw new AppError('La habitación cambió de estado; actualice e intente nuevamente', 409);
                }
            }
        });

        return updatedReservation;
    } catch (error) {
        if (
            error.code === 20
            && /transaction|replica set|mongos/i.test(error.message || '')
        ) {
            throw new AppError(
                'MongoDB debe ejecutarse como replica set para modificar reservaciones de forma segura',
                503
            );
        }
        throw error;
    } finally {
        await session.endSession();
    }
};

const parseFilterDate = (value, fieldName) => {
    if (!isValidDateOnly(value)) {
        throw new AppError(`${fieldName} debe ser una fecha válida con formato AAAA-MM-DD`, 400);
    }

    return new Date(`${value}T00:00:00.000Z`);
};

const getAvailableRooms = async (checkInValue, checkOutValue, roomId, { type, guests, maxPrice } = {}) => {
    const { checkIn, checkOut } = getDateRange(checkInValue, checkOutValue);
    const roomFilter = {
        status: { $nin: UNAVAILABLE_ROOM_STATUSES }
    };

    if (roomId) {
        roomFilter._id = roomId;
    }

    if (type) {
        roomFilter.type = type;
    }

    if (guests) {
        roomFilter.capacity = { $gte: Number(guests) };
    }

    if (maxPrice) {
        roomFilter.price = { $lte: Number(maxPrice) };
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

const getReservations = async ({ checkInFrom, checkInTo, roomId, roomType, status } = {}) => {
    const filters = {};

    if (checkInFrom || checkInTo) {
        const dateRange = {};

        if (checkInFrom) {
            dateRange.$gte = parseFilterDate(checkInFrom, 'La fecha inicial');
        }

        if (checkInTo) {
            const endDate = parseFilterDate(checkInTo, 'La fecha final');
            endDate.setUTCDate(endDate.getUTCDate() + 1);
            dateRange.$lt = endDate;
        }

        if (dateRange.$gte && dateRange.$lt && dateRange.$gte >= dateRange.$lt) {
            throw new AppError('La fecha final debe ser igual o posterior a la fecha inicial', 400);
        }

        filters.checkIn = dateRange;
    }

    if (roomId) filters.room = roomId;
    if (roomType) filters.roomType = roomType;
    if (status) filters.status = status;

    return Reservation.find(filters)
        .select('guest.fullName room roomNumber roomType checkIn checkOut nights status totalAmount')
        .sort({ checkIn: 1, createdAt: -1 });
};

const getSettlementHistory = async () => Reservation.find({
    status: 'finalizada',
    'settlement.status': 'pagada'
})
    .select('guest.fullName guest.identification guest.email guest.phone roomNumber roomType checkIn checkOut checkInAt checkOutAt settlement')
    .sort({ 'settlement.paidAt': -1, createdAt: -1 });

const getReservationById = async reservationId => {
    const reservation = await Reservation.findById(reservationId);

    if (!reservation) {
        throw new AppError('No se encontró la reservación solicitada', 404);
    }

    return reservation;
};

const cancelReservation = async (reservationId, reason, canceledBy) => {
    const normalizedReason = typeof reason === 'string' ? reason.trim() : '';
    if (normalizedReason.length < 3 || normalizedReason.length > 500) {
        throw new AppError('El motivo de cancelación debe tener entre 3 y 500 caracteres', 400);
    }

    const reservation = await Reservation.findOneAndUpdate(
        {
            _id: reservationId,
            status: 'reservada',
            checkInAt: { $exists: false }
        },
        {
            $set: {
                status: 'cancelada',
                cancellation: {
                    reason: normalizedReason,
                    canceledAt: new Date(),
                    canceledBy
                }
            }
        },
        { new: true, runValidators: true }
    );

    if (reservation) {
        return reservation;
    }

    const existingReservation = await Reservation.findById(reservationId).select('status checkInAt');
    if (!existingReservation) {
        throw new AppError('La reservación no existe', 404);
    }

    if (existingReservation.status === 'cancelada') {
        throw new AppError('La reservación ya fue cancelada', 409);
    }

    if (existingReservation.status === 'ocupada' || existingReservation.checkInAt) {
        throw new AppError('No se puede cancelar: ya se registró el check-in', 409);
    }

    throw new AppError('Solo se pueden cancelar reservaciones pendientes de check-in', 409);
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
    addReservationConsumption,
    getPendingCheckIns,
    checkInReservation,
    getPendingCheckOuts,
    checkOutReservation,
    getAvailableRooms,
    getReservations,
    getSettlementHistory,
    getReservationById,
    createReservation,
    updateReservation,
    cancelReservation,
    getReservationConsumptions,
    updateReservationConsumption,
    voidReservationConsumption
};
