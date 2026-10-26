jest.mock('../models/counter', () => ({
    findOneAndUpdate: jest.fn()
}));

jest.mock('../models/reservation', () => ({
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn()
}));

const Counter = require('../models/counter');
const Reservation = require('../models/reservation');
const {
    formatReceiptNumber,
    getNextReceiptNumber,
    getReceipt
} = require('./receiptService');

const chain = result => ({ select: () => ({ lean: () => Promise.resolve(result) }) });

const paidReservation = (settlementChanges = {}) => ({
    _id: 'reservation-id',
    guest: { fullName: 'Ana Pérez', identification: '1020', email: 'ana@correo.co', phone: '3001234567' },
    roomNumber: '101',
    roomType: 'Doble',
    checkInAt: new Date('2026-10-18T15:00:00.000Z'),
    checkOutAt: new Date('2026-10-20T11:00:00.000Z'),
    settlement: {
        status: 'pagada',
        actualNights: 2,
        nightlyRate: 100000,
        roomSubtotal: 200000,
        consumptions: [{ description: 'Agua', quantity: 2, unitPrice: 4500, subtotal: 9000 }],
        consumptionsTotal: 9000,
        additionalCharges: [{ description: 'Lavandería', quantity: 1, unitPrice: 15000, amount: 15000 }],
        additionalChargesTotal: 15000,
        totalAmount: 224000,
        paidAmount: 224000,
        paymentMethod: 'tarjeta',
        paidAt: new Date('2026-10-20T11:00:00.000Z'),
        receiptNumber: 'CP-000007',
        ...settlementChanges
    }
});

describe('receipt numbering', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('formats receipt numbers with six digits', () => {
        expect(formatReceiptNumber(1)).toBe('CP-000001');
        expect(formatReceiptNumber(1234567)).toBe('CP-1234567');
    });

    it('takes the next number atomically, inside the given transaction', async () => {
        const session = { id: 'session' };
        Counter.findOneAndUpdate.mockResolvedValue({ seq: 15 });

        await expect(getNextReceiptNumber(session)).resolves.toBe('CP-000015');
        expect(Counter.findOneAndUpdate).toHaveBeenCalledWith(
            { _id: 'paymentReceipt' },
            { $inc: { seq: 1 } },
            { returnDocument: 'after', upsert: true, session }
        );
    });
});

describe('getReceipt', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('builds an itemized receipt for a paid stay', async () => {
        Reservation.findOne.mockReturnValue(chain(paidReservation()));

        const receipt = await getReceipt('reservation-id');

        expect(Reservation.findOne).toHaveBeenCalledWith({
            _id: 'reservation-id',
            status: 'finalizada',
            'settlement.status': 'pagada'
        });
        expect(receipt).toMatchObject({
            receiptNumber: 'CP-000007',
            hotel: { name: 'Hotel Boutique' },
            guest: { fullName: 'Ana Pérez', identification: '1020' },
            stay: { roomNumber: '101', nights: 2 },
            paymentMethod: 'tarjeta',
            totals: { accommodation: 200000, consumptions: 9000, additionalCharges: 15000, total: 224000, paid: 224000, balance: 0 }
        });
        expect(receipt.lines).toEqual([
            { category: 'Alojamiento', description: 'Habitación 101 · Doble', quantity: 2, unitPrice: 100000, subtotal: 200000 },
            { category: 'Consumo', description: 'Agua', quantity: 2, unitPrice: 4500, subtotal: 9000 },
            { category: 'Cargo adicional', description: 'Lavandería', quantity: 1, unitPrice: 15000, subtotal: 15000 }
        ]);
        expect(Counter.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it('rejects stays that are not finished and paid', async () => {
        Reservation.findOne.mockReturnValue(chain(null));

        await expect(getReceipt('reservation-id')).rejects.toMatchObject({
            message: 'Solo se emite comprobante para estancias finalizadas y pagadas',
            statusCode: 404
        });
    });

    it('numbers a payment registered before receipts existed, only once', async () => {
        const legacy = paidReservation({ receiptNumber: undefined });
        Reservation.findOne.mockReturnValue(chain(legacy));
        Counter.findOneAndUpdate.mockResolvedValue({ seq: 30 });
        Reservation.findOneAndUpdate.mockReturnValue(chain(paidReservation({ receiptNumber: 'CP-000030' })));

        const receipt = await getReceipt('reservation-id');

        expect(receipt.receiptNumber).toBe('CP-000030');
        expect(Reservation.findOneAndUpdate).toHaveBeenCalledWith(
            { _id: 'reservation-id', 'settlement.receiptNumber': { $exists: false } },
            { $set: { 'settlement.receiptNumber': 'CP-000030' } },
            { returnDocument: 'after' }
        );
    });

    it('keeps the number saved by a concurrent request', async () => {
        Reservation.findOne
            .mockReturnValueOnce(chain(paidReservation({ receiptNumber: undefined })))
            .mockReturnValueOnce(chain(paidReservation({ receiptNumber: 'CP-000029' })));
        Counter.findOneAndUpdate.mockResolvedValue({ seq: 31 });
        Reservation.findOneAndUpdate.mockReturnValue(chain(null));

        await expect(getReceipt('reservation-id')).resolves.toMatchObject({ receiptNumber: 'CP-000029' });
    });
});
