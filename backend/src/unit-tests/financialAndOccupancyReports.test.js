jest.mock('../models/reservation', () => ({ find: jest.fn() }));
jest.mock('../models/room', () => ({ find: jest.fn() }));

const Reservation = require('../models/reservation');
const Room = require('../models/room');
const { getOccupancyReport } = require('../services/occupancyReportService');
const { getIncomeReport } = require('../services/incomeReportService');
const { getSalesReport } = require('../services/salesReportService');

const createQuery = result => {
    const query = {
        select: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(result)
    };
    return query;
};

describe('occupancyReportService', () => {
    beforeEach(() => jest.clearAllMocks());

    it('clasifica habitaciones ocupadas, reservadas, disponibles y fuera de servicio', async () => {
        const rooms = [
            { _id: 'occupied', number: '101', type: 'Sencilla', capacity: 1, status: 'disponible' },
            { _id: 'reserved', number: '102', type: 'Doble', capacity: 2, status: 'disponible' },
            { _id: 'available', number: '103', type: 'Suite', capacity: 2, status: 'disponible' },
            { _id: 'unavailable', number: '104', type: 'Doble', capacity: 2, status: 'mantenimiento' }
        ];
        const roomQuery = createQuery(rooms);
        const reservationQuery = createQuery([
            {
                room: 'occupied',
                status: 'finalizada',
                checkInAt: new Date('2026-10-25T10:00:00.000Z'),
                checkOutAt: new Date('2026-10-25T18:00:00.000Z')
            },
            { room: 'reserved', status: 'reservada', checkIn: new Date('2026-10-25T00:00:00.000Z'), checkOut: new Date('2026-10-26T00:00:00.000Z') }
        ]);
        Room.find.mockReturnValue(roomQuery);
        Reservation.find.mockReturnValue(reservationQuery);

        const report = await getOccupancyReport('2026-10-25', '2026-10-25');

        expect(report.totalRooms).toBe(4);
        expect(report.occupiedRooms.map(room => room.id)).toEqual(['occupied']);
        expect(report.reservedRooms.map(room => room.id)).toEqual(['reserved']);
        expect(report.availableRooms.map(room => room.id)).toEqual(['available']);
        expect(report.unavailableRooms.map(room => room.id)).toEqual(['unavailable']);
        expect(Reservation.find).toHaveBeenCalledWith(expect.objectContaining({
            room: { $in: ['occupied', 'reserved', 'available', 'unavailable'] }
        }));
    });

    it('devuelve categorías vacías cuando no hay habitaciones', async () => {
        Room.find.mockReturnValue(createQuery([]));

        await expect(getOccupancyReport('2026-10-25', '2026-10-25')).resolves.toMatchObject({
            totalRooms: 0,
            occupiedRooms: [],
            reservedRooms: [],
            availableRooms: [],
            unavailableRooms: []
        });
        expect(Reservation.find).not.toHaveBeenCalled();
    });
});

describe('incomeReportService', () => {
    beforeEach(() => jest.clearAllMocks());

    it('suma ingresos en centavos y devuelve el detalle de liquidaciones del periodo', async () => {
        const paidAt = new Date('2026-10-25T17:00:00.000Z');
        const query = createQuery([{
            _id: 'reservation-1',
            guest: { fullName: 'Ana Pérez' },
            roomNumber: '101',
            roomType: 'Suite',
            settlement: {
                paidAt,
                roomSubtotal: 200000.1,
                consumptionsTotal: 1500.25,
                additionalChargesTotal: 100.5,
                paidAmount: 201600.85
            }
        }]);
        Reservation.find.mockReturnValue(query);

        const report = await getIncomeReport('2026-10-25', '2026-10-25');

        expect(report).toMatchObject({
            settlementCount: 1,
            totals: {
                accommodation: 200000.1,
                products: 1500.25,
                additionalCharges: 100.5,
                collected: 201600.85
            },
            settlements: [{
                id: 'reservation-1',
                paidAt,
                guestName: 'Ana Pérez',
                roomNumber: '101',
                roomType: 'Suite'
            }]
        });
        expect(Reservation.find).toHaveBeenCalledWith({
            status: 'finalizada',
            'settlement.status': 'pagada',
            'settlement.paidAt': {
                $gte: new Date('2026-10-25T00:00:00.000Z'),
                $lt: new Date('2026-10-26T00:00:00.000Z')
            }
        });
    });
});

describe('salesReportService', () => {
    beforeEach(() => jest.clearAllMocks());

    it('agrupa ventas por descripción y calcula ingresos, unidades y productos', async () => {
        Reservation.find.mockReturnValue(createQuery([
            { settlement: { consumptions: [
                { description: 'Agua', quantity: 2, subtotal: 5000 },
                { description: ' Snack ', quantity: 1, amount: 3000 }
            ] } },
            { settlement: { consumptions: [
                { description: 'Agua', quantity: 1, subtotal: 2500 }
            ] } }
        ]));

        await expect(getSalesReport('2026-10-25', '2026-10-25')).resolves.toMatchObject({
            settlementCount: 2,
            totals: { revenue: 10500, quantity: 4, productCount: 2 },
            products: [
                { description: 'Agua', quantity: 3, total: 7500 },
                { description: 'Snack', quantity: 1, total: 3000 }
            ]
        });
    });
});
