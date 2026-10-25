const Room = require('../models/room');
const AppError = require('../utils/AppError');

const getAllRooms = async () => {

    return await Room
        .find()
        .sort({ number: 1 });
};

const createRoom = async ({ number, type, price, status }) => {
    const normalizedNumber = number.trim();
    const existingRoom = await Room.findOne({ number: normalizedNumber });

    if (existingRoom) {
        throw new AppError('Ya existe una habitación con ese número', 409);
    }

    try {
        return await Room.create({
            number: normalizedNumber,
            type: type.trim(),
            price,
            status
        });
    } catch (error) {
        if (error.code === 11000) {
            throw new AppError('Ya existe una habitación con ese número', 409);
        }

        throw error;
    }
};

module.exports = {
    getAllRooms,
    createRoom
};