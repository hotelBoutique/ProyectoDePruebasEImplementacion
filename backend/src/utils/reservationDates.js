const AppError = require('./AppError');

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;

const isValidDateOnly = value => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return false;
    }

    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

const getTodayDateOnly = () => new Date().toISOString().slice(0, 10);

const getDateRange = (checkInValue, checkOutValue) => {
    if (!isValidDateOnly(checkInValue)) {
        throw new AppError('El check-in debe ser una fecha válida con formato AAAA-MM-DD', 400);
    }

    if (!isValidDateOnly(checkOutValue)) {
        throw new AppError('El check-out debe ser una fecha válida con formato AAAA-MM-DD', 400);
    }

    if (checkOutValue <= checkInValue) {
        throw new AppError('El check-out debe ser posterior al check-in', 400);
    }

    if (checkInValue < getTodayDateOnly()) {
        throw new AppError('La fecha de check-in no puede estar en el pasado', 400);
    }

    const checkIn = new Date(`${checkInValue}T00:00:00.000Z`);
    const checkOut = new Date(`${checkOutValue}T00:00:00.000Z`);

    return {
        checkIn,
        checkOut,
        nights: (checkOut.getTime() - checkIn.getTime()) / DAY_IN_MILLISECONDS
    };
};

module.exports = {
    isValidDateOnly,
    getTodayDateOnly,
    getDateRange
};
