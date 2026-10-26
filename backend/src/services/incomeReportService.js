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
    const productTotals = new Map();

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

        (settlement.consumptions || []).forEach(item => {
            const description = typeof item.description === 'string'
                ? item.description.trim()
                : 'Consumo';
            const current = productTotals.get(description) || { quantity: 0, totalCents: 0 };
            current.quantity += Number(item.quantity || 0);
            current.totalCents += toCents(item.subtotal ?? item.amount);
            productTotals.set(description, current);
        });

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
        products: [...productTotals.entries()]
            .map(([description, values]) => ({
                description,
                quantity: values.quantity,
                total: fromCents(values.totalCents)
            }))
            .sort((left, right) => right.total - left.total || left.description.localeCompare(right.description, 'es')),
        settlements
    };
};

module.exports = { getIncomeReport };
