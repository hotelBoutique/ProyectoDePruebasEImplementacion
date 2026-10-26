const Reservation = require('../models/reservation');

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;
const toDate = value => new Date(`${value}T00:00:00.000Z`);
const toCents = value => Math.round(Number(value || 0) * 100);
const fromCents = value => value / 100;

const getIncomeReport = async (startDateValue, endDateValue) => {
    const rangeStart = toDate(startDateValue);
    const rangeEnd = new Date(toDate(endDateValue).getTime() + DAY_IN_MILLISECONDS);
    const reservations = await Reservation.find({
        status: 'finalizada',
        'settlement.status': 'pagada',
        'settlement.paidAt': { $gte: rangeStart, $lt: rangeEnd }
    })
        .select('guest.fullName roomNumber roomType settlement')
        .sort({ 'settlement.paidAt': -1, createdAt: -1 })
        .lean();

    const totals = {
        accommodation: 0,
        products: 0,
        additionalCharges: 0,
        collected: 0
    };

    const settlements = reservations.map(reservation => {
        const settlement = reservation.settlement || {};
        const accommodationCents = toCents(settlement.roomSubtotal);
        const productsCents = toCents(settlement.consumptionsTotal);
        const additionalChargesCents = toCents(settlement.additionalChargesTotal);
        const collectedCents = toCents(settlement.paidAmount);

        totals.accommodation += accommodationCents;
        totals.products += productsCents;
        totals.additionalCharges += additionalChargesCents;
        totals.collected += collectedCents;

        return {
            id: String(reservation._id),
            paidAt: settlement.paidAt,
            guestName: reservation.guest?.fullName || '—',
            roomNumber: reservation.roomNumber || '—',
            roomType: reservation.roomType || '—',
            accommodation: fromCents(accommodationCents),
            products: fromCents(productsCents),
            additionalCharges: fromCents(additionalChargesCents),
            collected: fromCents(collectedCents)
        };
    });

    return {
        startDate: startDateValue,
        endDate: endDateValue,
        settlementCount: settlements.length,
        totals: Object.fromEntries(
            Object.entries(totals).map(([key, value]) => [key, fromCents(value)])
        ),
        settlements
    };
};

module.exports = { getIncomeReport };
