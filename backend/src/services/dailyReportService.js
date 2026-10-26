const Reservation = require('../models/reservation');
const Room = require('../models/room');
const { getTodayDateOnly } = require('../utils/reservationDates');

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;
const PAYMENT_METHODS = ['efectivo', 'tarjeta', 'transferencia'];

const toDate = value => new Date(`${value}T00:00:00.000Z`);
const toCents = value => Math.round(Number(value || 0) * 100);
const fromCents = value => value / 100;
const isWithin = (value, start, end) => Boolean(value) && new Date(value) >= start && new Date(value) < end;
const byRoomNumber = (a, b) => String(a.roomNumber).localeCompare(String(b.roomNumber), 'es', { numeric: true });

const getDayRange = dateValue => {
    const dayStart = toDate(dateValue);
    const dayEnd = new Date(dayStart.getTime() + DAY_IN_MILLISECONDS);

    return { dayStart, dayEnd, day: { $gte: dayStart, $lt: dayEnd } };
};

const findArrivals = async dateValue => {
    const { day } = getDayRange(dateValue);
    const arrivals = await Reservation.find({ checkIn: day, status: { $ne: 'cancelada' } })
        .select('guest.fullName guest.phone roomNumber roomType nights checkOut status checkInAt')
        .lean();

    return arrivals
        .map(reservation => ({
            id: String(reservation._id),
            guestName: reservation.guest?.fullName || '—',
            guestPhone: reservation.guest?.phone || '',
            roomNumber: reservation.roomNumber,
            roomType: reservation.roomType,
            nights: reservation.nights,
            plannedCheckOut: reservation.checkOut,
            status: reservation.status === 'reservada' ? 'pendiente' : 'registrada',
            checkInAt: reservation.checkInAt || null
        }))
        .sort(byRoomNumber);
};

const findDepartures = async dateValue => {
    const { day } = getDayRange(dateValue);
    const departures = await Reservation.find({
        status: { $in: ['ocupada', 'finalizada'] },
        $or: [{ checkOut: day }, { checkOutAt: day }]
    })
        .select('guest.fullName guest.phone roomNumber roomType checkIn checkOut checkOutAt status settlement.paidAmount')
        .lean();

    return departures
        .map(reservation => ({
            id: String(reservation._id),
            guestName: reservation.guest?.fullName || '—',
            guestPhone: reservation.guest?.phone || '',
            roomNumber: reservation.roomNumber,
            roomType: reservation.roomType,
            checkIn: reservation.checkIn,
            plannedCheckOut: reservation.checkOut,
            status: reservation.status === 'finalizada' ? 'realizada' : 'pendiente',
            checkOutAt: reservation.checkOutAt || null,
            paidAmount: reservation.settlement?.paidAmount ?? null
        }))
        .sort(byRoomNumber);
};

const countDone = (items, doneStatus) => items.filter(item => item.status === doneStatus).length;

const getArrivalsReport = async (dateValue = getTodayDateOnly()) => {
    const arrivals = await findArrivals(dateValue);
    const checkedIn = countDone(arrivals, 'registrada');

    return {
        date: dateValue,
        summary: { expected: arrivals.length, checkedIn, pending: arrivals.length - checkedIn },
        arrivals
    };
};

const getDeparturesReport = async (dateValue = getTodayDateOnly()) => {
    const departures = await findDepartures(dateValue);
    const completed = countDone(departures, 'realizada');

    return {
        date: dateValue,
        summary: { expected: departures.length, completed, pending: departures.length - completed },
        departures
    };
};

const getDailyReport = async (dateValue = getTodayDateOnly()) => {
    const { dayStart, dayEnd, day } = getDayRange(dateValue);

    const [
        arrivals,
        departures,
        payments,
        cancellations,
        consumptionStays,
        newReservations,
        occupiedRoomIds,
        totalRooms
    ] = await Promise.all([
        findArrivals(dateValue),
        findDepartures(dateValue),
        Reservation.find({ 'settlement.paidAt': day })
            .select('guest.fullName roomNumber settlement')
            .lean(),
        Reservation.find({ 'cancellation.canceledAt': day })
            .select('guest.fullName roomNumber checkIn cancellation')
            .lean(),
        Reservation.find({ 'consumptions.createdAt': day })
            .select('consumptions')
            .lean(),
        Reservation.countDocuments({ createdAt: day }),
        // Habitaciones con un huésped alojado en algún momento del día.
        Reservation.distinct('room', {
            checkInAt: { $lt: dayEnd },
            $or: [
                { status: 'ocupada' },
                { status: 'finalizada', checkOutAt: { $gt: dayStart } }
            ]
        }),
        Room.countDocuments({})
    ]);

    const byMethodCents = Object.fromEntries(PAYMENT_METHODS.map(method => [method, 0]));
    let collectedCents = 0;
    const paymentItems = payments
        .map(reservation => {
            const amountCents = toCents(reservation.settlement?.paidAmount);
            const method = reservation.settlement?.paymentMethod;
            collectedCents += amountCents;
            if (method in byMethodCents) byMethodCents[method] += amountCents;

            return {
                id: String(reservation._id),
                guestName: reservation.guest?.fullName || '—',
                roomNumber: reservation.roomNumber,
                method,
                amount: fromCents(amountCents),
                paidAt: reservation.settlement?.paidAt
            };
        })
        .sort((a, b) => new Date(a.paidAt) - new Date(b.paidAt));

    const cancellationItems = cancellations
        .map(reservation => ({
            id: String(reservation._id),
            guestName: reservation.guest?.fullName || '—',
            roomNumber: reservation.roomNumber,
            checkIn: reservation.checkIn,
            reason: reservation.cancellation?.reason || '',
            canceledAt: reservation.cancellation?.canceledAt
        }))
        .sort((a, b) => new Date(a.canceledAt) - new Date(b.canceledAt));

    // Una estancia puede tener consumos de varios días: solo cuentan los registrados en la fecha.
    let consumptionsCount = 0;
    let consumptionsCents = 0;
    consumptionStays.forEach(reservation => {
        (reservation.consumptions || []).forEach(consumption => {
            if (consumption.status === 'anulado' || !isWithin(consumption.createdAt, dayStart, dayEnd)) return;
            consumptionsCount += 1;
            consumptionsCents += toCents(consumption.subtotal ?? consumption.amount);
        });
    });

    const arrivalsCheckedIn = countDone(arrivals, 'registrada');
    const departuresCompleted = countDone(departures, 'realizada');
    const occupiedRooms = occupiedRoomIds.length;

    return {
        date: dateValue,
        summary: {
            arrivalsExpected: arrivals.length,
            arrivalsCheckedIn,
            arrivalsPending: arrivals.length - arrivalsCheckedIn,
            departuresExpected: departures.length,
            departuresCompleted,
            departuresPending: departures.length - departuresCompleted,
            occupiedRooms,
            totalRooms,
            occupancyRate: totalRooms ? Math.round((occupiedRooms / totalRooms) * 100) : 0,
            newReservations,
            cancellations: cancellationItems.length,
            paymentsCount: paymentItems.length,
            collected: fromCents(collectedCents),
            consumptionsCount,
            consumptionsTotal: fromCents(consumptionsCents)
        },
        payments: {
            byMethod: Object.fromEntries(
                Object.entries(byMethodCents).map(([method, cents]) => [method, fromCents(cents)])
            ),
            items: paymentItems
        },
        cancellations: cancellationItems
    };
};

const getCurrentOccupancyReport = async () => {
    const today = getTodayDateOnly();
    const { day } = getDayRange(today);
    const [rooms, stays, arrivalsToday] = await Promise.all([
        Room.find({}).select('number type capacity status').lean(),
        Reservation.find({ status: 'ocupada' })
            .select('room guest.fullName checkInAt checkOut')
            .lean(),
        Reservation.find({ status: 'reservada', checkIn: day })
            .select('room guest.fullName')
            .lean()
    ]);

    const stayByRoom = new Map(stays.map(stay => [String(stay.room), stay]));
    const arrivalByRoom = new Map(arrivalsToday.map(arrival => [String(arrival.room), arrival]));
    const todayStart = toDate(today);

    const roomItems = rooms
        .map(room => {
            const roomId = String(room._id);
            const stay = stayByRoom.get(roomId);
            const arrival = arrivalByRoom.get(roomId);
            const item = {
                id: roomId,
                roomNumber: room.number,
                roomType: room.type,
                capacity: room.capacity ?? null,
                roomStatus: room.status
            };

            if (stay || room.status === 'ocupada') {
                return {
                    ...item,
                    state: 'ocupada',
                    guestName: stay?.guest?.fullName || null,
                    checkInAt: stay?.checkInAt || null,
                    plannedCheckOut: stay?.checkOut || null,
                    // Se quedó después de la fecha de salida prevista.
                    overdue: Boolean(stay?.checkOut && new Date(stay.checkOut) < todayStart)
                };
            }

            if (room.status !== 'disponible') {
                return { ...item, state: 'fuera de operación' };
            }

            return {
                ...item,
                state: 'disponible',
                arrivingToday: arrival ? arrival.guest?.fullName || '—' : null
            };
        })
        .sort(byRoomNumber);

    const count = state => roomItems.filter(item => item.state === state).length;
    const occupied = count('ocupada');

    return {
        generatedAt: new Date(),
        summary: {
            totalRooms: roomItems.length,
            occupied,
            available: count('disponible'),
            outOfService: count('fuera de operación'),
            arrivingToday: roomItems.filter(item => item.arrivingToday).length,
            overdue: roomItems.filter(item => item.overdue).length,
            occupancyRate: roomItems.length ? Math.round((occupied / roomItems.length) * 100) : 0
        },
        rooms: roomItems
    };
};

module.exports = {
    getDailyReport,
    getArrivalsReport,
    getDeparturesReport,
    getCurrentOccupancyReport
};
