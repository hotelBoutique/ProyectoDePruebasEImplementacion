const Reservation = require('../models/reservation');
const Room = require('../models/room');

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;

const toDate = value => new Date(`${value}T00:00:00.000Z`);

const overlaps = (stayStart, stayEnd, rangeStart, rangeEnd) => (
    stayStart < rangeEnd && stayEnd > rangeStart
);

const toRoomSummary = room => ({
    id: String(room._id),
    number: room.number,
    type: room.type,
    capacity: room.capacity,
    status: room.status
});

const getOccupancyReport = async (startDateValue, endDateValue) => {
    const rangeStart = toDate(startDateValue);
    const rangeEnd = new Date(toDate(endDateValue).getTime() + DAY_IN_MILLISECONDS);
    const rooms = await Room.find({}).sort({ number: 1 }).lean();

    if (!rooms.length) {
        return {
            startDate: startDateValue,
            endDate: endDateValue,
            totalRooms: 0,
            occupiedRooms: [],
            reservedRooms: [],
            availableRooms: [],
            unavailableRooms: []
        };
    }

    const now = new Date();
    const reservations = await Reservation.find({
        room: { $in: rooms.map(room => room._id) },
        $or: [
            {
                status: 'ocupada',
                checkInAt: { $lt: rangeEnd }
            },
            {
                status: 'finalizada',
                checkInAt: { $lt: rangeEnd },
                checkOutAt: { $gt: rangeStart }
            },
            {
                status: 'reservada',
                checkIn: { $lt: rangeEnd },
                checkOut: { $gt: rangeStart }
            }
        ]
    })
        .select('room status checkIn checkOut checkInAt checkOutAt')
        .lean();

    const occupiedByRoom = new Map();
    const reservedRoomIds = new Set();

    reservations.forEach(reservation => {
        const roomId = String(reservation.room);

        if (reservation.status === 'reservada') {
            const stayStart = new Date(reservation.checkIn);
            const stayEnd = new Date(reservation.checkOut);
            if (overlaps(stayStart, stayEnd, rangeStart, rangeEnd)) {
                reservedRoomIds.add(roomId);
            }
            return;
        }

        if (!reservation.checkInAt) return;

        const stayStart = new Date(reservation.checkInAt);
        const stayEnd = reservation.checkOutAt
            ? new Date(reservation.checkOutAt)
            : now;

        if (!overlaps(stayStart, stayEnd, rangeStart, rangeEnd)) return;

        const roomStays = occupiedByRoom.get(roomId) || [];
        roomStays.push({
            checkInAt: reservation.checkInAt,
            checkOutAt: reservation.checkOutAt || null
        });
        occupiedByRoom.set(roomId, roomStays);
    });

    const occupiedRooms = [];
    const reservedRooms = [];
    const availableRooms = [];
    const unavailableRooms = [];

    rooms.forEach(room => {
        const summary = toRoomSummary(room);
        const roomId = String(room._id);
        const stays = occupiedByRoom.get(roomId);

        if (stays?.length) {
            occupiedRooms.push({ ...summary, stays });
        } else if (room.status !== 'disponible') {
            unavailableRooms.push(summary);
        } else if (reservedRoomIds.has(roomId)) {
            reservedRooms.push(summary);
        } else {
            availableRooms.push(summary);
        }
    });

    return {
        startDate: startDateValue,
        endDate: endDateValue,
        totalRooms: rooms.length,
        occupiedRooms,
        reservedRooms,
        availableRooms,
        unavailableRooms
    };
};

module.exports = { getOccupancyReport };
