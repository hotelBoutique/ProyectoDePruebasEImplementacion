const {
    getDateRange,
    getTodayDateOnly,
    isValidDateOnly
} = require('./reservationDates');

describe('reservation date validation', () => {
    it('accepts only real ISO date-only values', () => {
        expect(isValidDateOnly('2028-02-29')).toBe(true);
        expect(isValidDateOnly('2027-02-29')).toBe(false);
        expect(isValidDateOnly('2028-2-09')).toBe(false);
        expect(isValidDateOnly(null)).toBe(false);
    });

    it('accepts today and returns a half-open stay range', () => {
        const today = getTodayDateOnly();
        const tomorrow = new Date(`${today}T00:00:00.000Z`);
        tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
        const checkOut = tomorrow.toISOString().slice(0, 10);

        expect(getDateRange(today, checkOut)).toMatchObject({
            checkIn: new Date(`${today}T00:00:00.000Z`),
            checkOut: new Date(`${checkOut}T00:00:00.000Z`),
            nights: 1
        });
    });

    it('rejects check-out equal to or earlier than check-in', () => {
        const tomorrow = new Date();
        tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
        const date = tomorrow.toISOString().slice(0, 10);

        expect(() => getDateRange(date, date)).toThrow('El check-out debe ser posterior al check-in');
        expect(() => getDateRange(date, '2000-01-01')).toThrow('El check-out debe ser posterior al check-in');
    });

    it('rejects a check-in date in the past', () => {
        expect(() => getDateRange('2000-01-01', '2000-01-02'))
            .toThrow('La fecha de check-in no puede estar en el pasado');
    });
});
