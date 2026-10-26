jest.mock('../models/reservation', () => ({
    find: jest.fn(),
    countDocuments: jest.fn(),
    distinct: jest.fn()
}));

jest.mock('../models/room', () => ({
    find: jest.fn(),
    countDocuments: jest.fn()
}));

jest.mock('../utils/reservationDates', () => ({
    getTodayDateOnly: () => '2026-10-20'
}));

const Reservation = require('../models/reservation');
const Room = require('../models/room');
const {
    getDailyReport,
    getArrivalsReport,
    getDeparturesReport,
    getCurrentOccupancyReport
} = require('./dailyReportService');

const DATE = '2026-10-20';
const at = time => new Date(`${DATE}T${time}.000Z`);
const DAY = { $gte: at('00:00:00'), $lt: new Date('2026-10-21T00:00:00.000Z') };
const chain = result => ({ select: () => ({ lean: () => Promise.resolve(result) }) });

// Cada consulta de Reservation.find se distingue por los campos que filtra.
const mockFinds = ({
    arrivals = [],
    departures = [],
    payments = [],
    cancellations = [],
    consumptions = [],
    stays = [],
    arrivalsToday = []
} = {}) => {
    Reservation.find.mockImplementation(query => {
        if (query.checkIn && query.status?.$ne) return chain(arrivals);
        if (query.checkIn && query.status === 'reservada') return chain(arrivalsToday);
        if (query.$or) return chain(departures);
        if (query['settlement.paidAt']) return chain(payments);
        if (query['cancellation.canceledAt']) return chain(cancellations);
        if (query['consumptions.createdAt']) return chain(consumptions);
        if (query.status === 'ocupada') return chain(stays);
        return chain([]);
    });
};

beforeEach(() => {
    jest.clearAllMocks();
    mockFinds();
    Reservation.countDocuments.mockResolvedValue(0);
    Reservation.distinct.mockResolvedValue([]);
    Room.countDocuments.mockResolvedValue(0);
    Room.find.mockReturnValue(chain([]));
});

describe('getArrivalsReport', () => {
    it('lists the day\'s arrivals by room, separating pending from checked in', async () => {
        mockFinds({
            arrivals: [
                { _id: 'a1', guest: { fullName: 'Ana', phone: '300' }, roomNumber: '201', status: 'ocupada', checkInAt: at('15:00:00'), nights: 2 },
                { _id: 'a2', guest: { fullName: 'Luis' }, roomNumber: '102', status: 'reservada', nights: 1 }
            ]
        });

        const report = await getArrivalsReport(DATE);

        expect(Reservation.find).toHaveBeenCalledWith({ checkIn: DAY, status: { $ne: 'cancelada' } });
        expect(report.summary).toEqual({ expected: 2, checkedIn: 1, pending: 1 });
        expect(report.arrivals.map(item => [item.roomNumber, item.status])).toEqual([
            ['102', 'pendiente'],
            ['201', 'registrada']
        ]);
        expect(report.arrivals[1].guestPhone).toBe('300');
    });

    it('uses today when no date is given', async () => {
        await expect(getArrivalsReport()).resolves.toMatchObject({ date: '2026-10-20' });
    });
});

describe('getDeparturesReport', () => {
    it('includes planned and actual departures, separating completed from pending', async () => {
        mockFinds({
            departures: [
                { _id: 'd1', guest: { fullName: 'Eva' }, roomNumber: '103', status: 'finalizada', checkOutAt: at('11:00:00'), settlement: { paidAmount: 200000 } },
                { _id: 'd2', guest: { fullName: 'Juan' }, roomNumber: '104', status: 'ocupada' }
            ]
        });

        const report = await getDeparturesReport(DATE);

        expect(Reservation.find).toHaveBeenCalledWith({
            status: { $in: ['ocupada', 'finalizada'] },
            $or: [{ checkOut: DAY }, { checkOutAt: DAY }]
        });
        expect(report.summary).toEqual({ expected: 2, completed: 1, pending: 1 });
        expect(report.departures.map(item => [item.status, item.paidAmount])).toEqual([
            ['realizada', 200000],
            ['pendiente', null]
        ]);
    });
});

describe('getDailyReport', () => {
    it('returns an empty summary for a quiet day', async () => {
        const report = await getDailyReport(DATE);

        expect(report.summary).toMatchObject({
            arrivalsExpected: 0,
            departuresExpected: 0,
            occupancyRate: 0,
            collected: 0,
            consumptionsCount: 0
        });
        expect(report.payments.byMethod).toEqual({ efectivo: 0, tarjeta: 0, transferencia: 0 });
        expect(Reservation.countDocuments).toHaveBeenCalledWith({ createdAt: DAY });
    });

    it('summarizes arrivals and departures without repeating their lists', async () => {
        mockFinds({
            arrivals: [{ _id: 'a1', roomNumber: '101', status: 'reservada' }],
            departures: [{ _id: 'd1', roomNumber: '102', status: 'finalizada' }]
        });

        const report = await getDailyReport(DATE);

        expect(report.summary).toMatchObject({
            arrivalsExpected: 1,
            arrivalsPending: 1,
            departuresExpected: 1,
            departuresCompleted: 1
        });
        expect(report).not.toHaveProperty('arrivals');
        expect(report).not.toHaveProperty('departures');
    });

    it('totals payments by method without floating point errors', async () => {
        mockFinds({
            payments: [
                { _id: 'p1', roomNumber: '101', settlement: { paidAmount: 100.1, paymentMethod: 'efectivo', paidAt: at('10:00:00') } },
                { _id: 'p2', roomNumber: '102', settlement: { paidAmount: 200.2, paymentMethod: 'efectivo', paidAt: at('09:00:00') } },
                { _id: 'p3', roomNumber: '103', settlement: { paidAmount: 50, paymentMethod: 'tarjeta', paidAt: at('12:00:00') } }
            ]
        });

        const report = await getDailyReport(DATE);

        expect(report.summary.collected).toBe(350.3);
        expect(report.payments.byMethod).toEqual({ efectivo: 300.3, tarjeta: 50, transferencia: 0 });
        expect(report.payments.items.map(item => item.id)).toEqual(['p2', 'p1', 'p3']);
    });

    it('counts only consumptions registered that day and not voided', async () => {
        mockFinds({
            consumptions: [{
                consumptions: [
                    { subtotal: 9000, status: 'registrado', createdAt: at('20:00:00') },
                    { subtotal: 4000, status: 'anulado', createdAt: at('21:00:00') },
                    { subtotal: 6000, status: 'registrado', createdAt: new Date('2026-10-19T22:00:00.000Z') }
                ]
            }]
        });

        const report = await getDailyReport(DATE);

        expect(report.summary.consumptionsCount).toBe(1);
        expect(report.summary.consumptionsTotal).toBe(9000);
    });

    it('computes occupancy and includes cancellations and new reservations', async () => {
        Reservation.distinct.mockResolvedValue(['room-1', 'room-2', 'room-3']);
        Room.countDocuments.mockResolvedValue(8);
        Reservation.countDocuments.mockResolvedValue(4);
        mockFinds({
            cancellations: [{
                _id: 'c1',
                guest: { fullName: 'Marta' },
                roomNumber: '105',
                cancellation: { reason: 'Cambio de planes', canceledAt: at('08:30:00') }
            }]
        });

        const report = await getDailyReport(DATE);

        expect(report.summary).toMatchObject({
            occupiedRooms: 3,
            totalRooms: 8,
            occupancyRate: 38,
            newReservations: 4,
            cancellations: 1
        });
        expect(report.cancellations[0]).toMatchObject({ guestName: 'Marta', reason: 'Cambio de planes' });
    });
});

describe('getCurrentOccupancyReport', () => {
    it('classifies each room as occupied, available or out of operation', async () => {
        Room.find.mockReturnValue(chain([
            { _id: 'r103', number: '103', type: 'Suite', status: 'mantenimiento' },
            { _id: 'r101', number: '101', type: 'Doble', status: 'ocupada' },
            { _id: 'r102', number: '102', type: 'Doble', status: 'disponible' },
            { _id: 'r104', number: '104', type: 'Sencilla', status: 'ocupada' }
        ]));
        mockFinds({
            stays: [
                { room: 'r101', guest: { fullName: 'Ana' }, checkInAt: at('15:00:00'), checkOut: new Date('2026-10-22T00:00:00.000Z') },
                { room: 'r104', guest: { fullName: 'Juan' }, checkInAt: new Date('2026-10-17T15:00:00.000Z'), checkOut: new Date('2026-10-19T00:00:00.000Z') }
            ],
            arrivalsToday: [{ room: 'r102', guest: { fullName: 'Luis' } }]
        });

        const report = await getCurrentOccupancyReport();

        expect(report.rooms.map(room => [room.roomNumber, room.state])).toEqual([
            ['101', 'ocupada'],
            ['102', 'disponible'],
            ['103', 'fuera de operación'],
            ['104', 'ocupada']
        ]);
        expect(report.rooms[0]).toMatchObject({ guestName: 'Ana', overdue: false });
        expect(report.rooms[1].arrivingToday).toBe('Luis');
        expect(report.rooms[3].overdue).toBe(true);
        expect(report.summary).toEqual({
            totalRooms: 4,
            occupied: 2,
            available: 1,
            outOfService: 1,
            arrivingToday: 1,
            overdue: 1,
            occupancyRate: 50
        });
    });

    it('returns zero occupancy when there are no rooms', async () => {
        const report = await getCurrentOccupancyReport();

        expect(report.summary).toMatchObject({ totalRooms: 0, occupancyRate: 0 });
        expect(report.rooms).toEqual([]);
    });
});
