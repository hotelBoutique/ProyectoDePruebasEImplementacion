const Counter = require('../models/counter');
const Reservation = require('../models/reservation');
const AppError = require('../utils/AppError');
const HOTEL = require('../constants/hotel');

const RECEIPT_COUNTER = 'paymentReceipt';
const RECEIPT_FIELDS = 'guest roomNumber roomType checkIn checkOut checkInAt checkOutAt settlement';

const toCents = value => Math.round(Number(value || 0) * 100);
const fromCents = value => value / 100;

const formatReceiptNumber = sequence => `CP-${String(sequence).padStart(6, '0')}`;

// Dentro de una transacción, si esta se aborta el consecutivo también se revierte y no quedan huecos.
const getNextReceiptNumber = async session => {
    const counter = await Counter.findOneAndUpdate(
        { _id: RECEIPT_COUNTER },
        { $inc: { seq: 1 } },
        { returnDocument: 'after', upsert: true, ...(session ? { session } : {}) }
    );

    return formatReceiptNumber(counter.seq);
};

const findPaidReservation = reservationId => Reservation.findOne({
    _id: reservationId,
    status: 'finalizada',
    'settlement.status': 'pagada'
})
    .select(RECEIPT_FIELDS)
    .lean();

// Los pagos registrados antes de existir los comprobantes reciben su número la primera vez que se consultan.
const assignMissingReceiptNumber = async reservation => {
    const receiptNumber = await getNextReceiptNumber();
    const updated = await Reservation.findOneAndUpdate(
        { _id: reservation._id, 'settlement.receiptNumber': { $exists: false } },
        { $set: { 'settlement.receiptNumber': receiptNumber } },
        { returnDocument: 'after' }
    )
        .select(RECEIPT_FIELDS)
        .lean();

    // Otra solicitud lo numeró al mismo tiempo: se usa el número que quedó guardado.
    return updated || findPaidReservation(reservation._id);
};

const toLine = (category, item) => ({
    category,
    description: item.description,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    subtotal: item.subtotal ?? item.amount
});

const buildReceipt = reservation => {
    const settlement = reservation.settlement;
    const consumptions = settlement.consumptions || [];
    const additionalCharges = settlement.additionalCharges || [];
    const lines = [
        {
            category: 'Alojamiento',
            description: `Habitación ${reservation.roomNumber} · ${reservation.roomType}`,
            quantity: settlement.actualNights,
            unitPrice: settlement.nightlyRate,
            subtotal: settlement.roomSubtotal
        },
        ...consumptions.map(item => toLine('Consumo', item)),
        ...additionalCharges.map(item => toLine('Cargo adicional', item))
    ];

    return {
        receiptNumber: settlement.receiptNumber,
        issuedAt: settlement.paidAt,
        hotel: HOTEL,
        reservationId: String(reservation._id),
        guest: {
            fullName: reservation.guest?.fullName || '',
            identification: reservation.guest?.identification || '',
            email: reservation.guest?.email || '',
            phone: reservation.guest?.phone || ''
        },
        stay: {
            roomNumber: reservation.roomNumber,
            roomType: reservation.roomType,
            checkInAt: reservation.checkInAt || reservation.checkIn,
            checkOutAt: reservation.checkOutAt || reservation.checkOut,
            nights: settlement.actualNights
        },
        lines,
        totals: {
            accommodation: settlement.roomSubtotal,
            consumptions: settlement.consumptionsTotal || 0,
            additionalCharges: settlement.additionalChargesTotal || 0,
            total: settlement.totalAmount,
            paid: settlement.paidAmount,
            // El check-out exige pagar el total exacto; se informa por si llegara a haber diferencia.
            balance: fromCents(toCents(settlement.totalAmount) - toCents(settlement.paidAmount))
        },
        paymentMethod: settlement.paymentMethod
    };
};

const getReceipt = async reservationId => {
    let reservation = await findPaidReservation(reservationId);

    if (!reservation) {
        throw new AppError('Solo se emite comprobante para estancias finalizadas y pagadas', 404);
    }

    if (!reservation.settlement.receiptNumber) {
        reservation = await assignMissingReceiptNumber(reservation);
    }

    return buildReceipt(reservation);
};

module.exports = {
    formatReceiptNumber,
    getNextReceiptNumber,
    buildReceipt,
    getReceipt
};
