const Reservation = require('../models/reservation');

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;
const toDate = value => new Date(`${value}T00:00:00.000Z`);
const toCents = value => Math.round(Number(value || 0) * 100);
const fromCents = value => value / 100;

const getSalesReport = async (startDateValue, endDateValue) => {
    const rangeStart = toDate(startDateValue);
    const rangeEnd = new Date(toDate(endDateValue).getTime() + DAY_IN_MILLISECONDS);
    const reservations = await Reservation.find({
        status: 'finalizada',
        'settlement.status': 'pagada',
        'settlement.paidAt': { $gte: rangeStart, $lt: rangeEnd }
    })
        .select('settlement')
        .sort({ 'settlement.paidAt': -1, createdAt: -1 })
        .lean();

    let totalRevenueCents = 0;
    let totalUnits = 0;
    const productTotals = new Map();

    reservations.forEach(reservation => {
        const items = reservation.settlement?.consumptions || [];

        items.forEach(item => {
            const description = typeof item.description === 'string'
                ? item.description.trim()
                : 'Consumo';
            const quantity = Number(item.quantity || 0);
            const subtotalCents = toCents(item.subtotal ?? item.amount);
            const current = productTotals.get(description) || { quantity: 0, totalCents: 0 };

            current.quantity += quantity;
            current.totalCents += subtotalCents;
            totalUnits += quantity;
            totalRevenueCents += subtotalCents;
            productTotals.set(description, current);
        });
    });

    const products = [...productTotals.entries()]
        .map(([description, values]) => ({
            description,
            quantity: values.quantity,
            total: fromCents(values.totalCents)
        }))
        .sort((left, right) => right.total - left.total || left.description.localeCompare(right.description, 'es'));

    return {
        startDate: startDateValue,
        endDate: endDateValue,
        settlementCount: reservations.length,
        totals: {
            revenue: fromCents(totalRevenueCents),
            quantity: totalUnits,
            productCount: products.length
        },
        products
    };
};

module.exports = { getSalesReport };
