jest.mock('../models/reservation', () => ({
    find: jest.fn(),
    findById: jest.fn(),
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
    countDocuments: jest.fn(),
    aggregate: jest.fn()
}));

jest.mock('../models/room', () => ({ find: jest.fn(), findById: jest.fn(), updateOne: jest.fn() }));
jest.mock('../models/product', () => ({ findOne: jest.fn(), updateOne: jest.fn() }));
jest.mock('../models/counter', () => ({ findOneAndUpdate: jest.fn() }));

const Reservation = require('../models/reservation');
const reservationService = require('../services/reservationService');

const createQuery = (result, terminal = 'lean') => {
    const query = {};
    ['select', 'sort', 'skip', 'limit', 'lean'].forEach(method => {
        query[method] = jest.fn().mockReturnValue(query);
    });

    if (terminal === 'sort') {
        query.sort.mockResolvedValue(result);
    } else {
        query.lean.mockResolvedValue(result);
    }

    return query;
};

describe('reservationService: consultas y cancelación aportadas', () => {
    beforeEach(() => jest.clearAllMocks());

    it('filtra reservaciones por rango inclusivo, habitación, tipo y estado', async () => {
        const reservations = [{ _id: 'reservation-1' }];
        const query = createQuery(reservations, 'sort');
        Reservation.find.mockReturnValue(query);

        await expect(reservationService.getReservations({
            checkInFrom: '2026-10-20',
            checkInTo: '2026-10-21',
            roomId: 'room-1',
            roomType: 'Suite',
            status: 'reservada'
        })).resolves.toBe(reservations);

        expect(Reservation.find).toHaveBeenCalledWith({
            checkIn: {
                $gte: new Date('2026-10-20T00:00:00.000Z'),
                $lt: new Date('2026-10-22T00:00:00.000Z')
            },
            room: 'room-1',
            roomType: 'Suite',
            status: 'reservada'
        });
        expect(query.select).toHaveBeenCalledWith(
            'guest.fullName room roomNumber roomType checkIn checkOut nights status totalAmount'
        );
        expect(query.sort).toHaveBeenCalledWith({ checkIn: 1, createdAt: -1 });
    });

    it('rechaza fechas inválidas al listar reservaciones antes de consultar el modelo', async () => {
        await expect(reservationService.getReservations({ checkInFrom: '2026-02-30' }))
            .rejects.toMatchObject({ statusCode: 400 });

        expect(Reservation.find).not.toHaveBeenCalled();
    });

    it('recupera una reservación por ID y responde 404 cuando no existe', async () => {
        const reservation = { _id: 'reservation-1' };
        Reservation.findById.mockResolvedValueOnce(reservation).mockResolvedValueOnce(null);

        await expect(reservationService.getReservationById('reservation-1')).resolves.toBe(reservation);
        await expect(reservationService.getReservationById('missing'))
            .rejects.toMatchObject({ statusCode: 404 });
    });

    it('consulta únicamente liquidaciones finalizadas y pagadas, ordenadas por fecha de pago', async () => {
        const settlements = [{ _id: 'settlement-1' }];
        const query = createQuery(settlements, 'sort');
        Reservation.find.mockReturnValue(query);

        await expect(reservationService.getSettlementHistory()).resolves.toBe(settlements);

        expect(Reservation.find).toHaveBeenCalledWith({
            status: 'finalizada',
            'settlement.status': 'pagada'
        });
        expect(query.sort).toHaveBeenCalledWith({ 'settlement.paidAt': -1, createdAt: -1 });
    });

    it('busca pagos, pagina los resultados y devuelve el resumen de recaudo', async () => {
        const payments = [{ _id: 'payment-1' }];
        const query = createQuery(payments);
        Reservation.find.mockReturnValue(query);
        Reservation.countDocuments.mockResolvedValueOnce(12).mockResolvedValueOnce(3);
        Reservation.aggregate.mockResolvedValue([{ total: 150000.5 }]);

        await expect(reservationService.getPayments({ page: 2, limit: 5 }))
            .resolves.toMatchObject({
                payments,
                pagination: { page: 2, limit: 5, total: 12, totalPages: 3 },
                summary: { totalPayments: 12, totalCollected: 150000.5, todayPayments: 3 }
            });

        expect(query.skip).toHaveBeenCalledWith(5);
        expect(query.limit).toHaveBeenCalledWith(5);
        expect(Reservation.aggregate).toHaveBeenCalledWith([
            { $match: Reservation.find.mock.calls[0][0] },
            { $group: { _id: null, total: { $sum: '$settlement.paidAmount' } } }
        ]);
    });

    it('combina búsqueda, método de pago y fechas en el filtro de pagos', async () => {
        Reservation.find.mockReturnValue(createQuery([]));
        Reservation.countDocuments.mockResolvedValue(0);
        Reservation.aggregate.mockResolvedValue([]);

        await reservationService.getPayments({
            q: 'Ana+',
            startDate: '2026-10-20',
            endDate: '2026-10-21',
            paymentMethod: 'efectivo'
        });

        const filter = Reservation.find.mock.calls[0][0];
        expect(filter.$and).toEqual(expect.arrayContaining([
            { status: 'finalizada' },
            { 'settlement.status': 'pagada' },
            { 'settlement.paymentMethod': 'efectivo' }
        ]));
        const paidAtFilter = filter.$and.find(condition => condition['settlement.paidAt']);
        expect(paidAtFilter['settlement.paidAt']).toHaveProperty('$gte');
        expect(paidAtFilter['settlement.paidAt']).toHaveProperty('$lt');
        const search = filter.$and.find(condition => condition.$or);
        expect(search.$or[0]['guest.fullName']).toEqual({ $regex: 'Ana\\+', $options: 'i' });
        expect(search.$or[1]['roomNumber']).toEqual({ $regex: 'Ana\\+', $options: 'i' });
    });

    it.each([
        [{ paymentMethod: 'cheque' }, 'método de pago'],
        [{ status: 'pendiente' }, 'estado del pago'],
        [{ startDate: '2026-10-22', endDate: '2026-10-21' }, 'fecha final']
    ])('rechaza filtros de pago inválidos: %j', async (filters) => {
        await expect(reservationService.getPayments(filters)).rejects.toMatchObject({ statusCode: 400 });
        expect(Reservation.find).not.toHaveBeenCalled();
    });

    it('devuelve un pago individual y responde 404 si no es un pago cerrado', async () => {
        const payment = { _id: 'payment-1' };
        Reservation.findOne.mockReturnValueOnce(createQuery(payment)).mockReturnValueOnce(createQuery(null));

        await expect(reservationService.getPaymentById('payment-1')).resolves.toBe(payment);
        await expect(reservationService.getPaymentById('missing'))
            .rejects.toMatchObject({ statusCode: 404 });
        expect(Reservation.findOne).toHaveBeenCalledWith({
            _id: 'payment-1',
            status: 'finalizada',
            'settlement.status': 'pagada'
        });
    });

    it('registra motivo, fecha y autor al cancelar una reservación pendiente', async () => {
        const reservation = { _id: 'reservation-1', status: 'cancelada' };
        Reservation.findOneAndUpdate.mockResolvedValue(reservation);

        await expect(reservationService.cancelReservation('reservation-1', '  Cambio de planes  ', 'admin-1'))
            .resolves.toBe(reservation);

        const [filter, update, options] = Reservation.findOneAndUpdate.mock.calls[0];
        expect(filter).toEqual({
            _id: 'reservation-1',
            status: 'reservada',
            checkInAt: { $exists: false }
        });
        expect(update.$set.status).toBe('cancelada');
        expect(update.$set.cancellation).toMatchObject({
            reason: 'Cambio de planes',
            canceledBy: 'admin-1',
            canceledAt: expect.any(Date)
        });
        expect(options).toEqual({ new: true, runValidators: true });
    });

    it('rechaza motivos cortos y no permite cancelar luego del check-in', async () => {
        await expect(reservationService.cancelReservation('reservation-1', 'no', 'admin-1'))
            .rejects.toMatchObject({ statusCode: 400 });
        expect(Reservation.findOneAndUpdate).not.toHaveBeenCalled();

        Reservation.findOneAndUpdate.mockResolvedValue(null);
        const select = jest.fn().mockResolvedValue({ status: 'ocupada', checkInAt: new Date() });
        Reservation.findById.mockReturnValue({ select });

        await expect(reservationService.cancelReservation('reservation-1', 'Motivo válido', 'admin-1'))
            .rejects.toMatchObject({ statusCode: 409, message: expect.stringContaining('check-in') });
    });
});
