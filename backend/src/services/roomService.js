const Room = require('../models/room');
const AppError = require('../utils/AppError');

const getAllRooms = async () => {

    return await Room
        .find()
        .sort({ number: 1 });
};

const createRoom = async ({ number, type, description, capacity, price, status }) => {
    const normalizedNumber = number.trim();
    const existingRoom = await Room.findOne({ number: normalizedNumber });

    if (existingRoom) {
        throw new AppError('Ya existe una habitación con ese número', 409);
    }

    try {
        return await Room.create({
            number: normalizedNumber,
            type: type.trim(),
            description: description == null ? '' : description.trim(),
            capacity,
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

const updateRoom = async (roomId, changes) => {
    const updates = { ...changes };

    if (updates.number !== undefined) {
        updates.number = updates.number.trim();

        const existingRoom = await Room.findOne({
            number: updates.number,
            _id: { $ne: roomId }
        });

        if (existingRoom) {
            throw new AppError('Ya existe una habitación con ese número', 409);
        }
    }

    if (updates.type !== undefined) {
        updates.type = updates.type.trim();
    }

    if (updates.description !== undefined) {
        updates.description = updates.description === null
            ? ''
            : updates.description.trim();
    }

    try {
        const room = await Room.findByIdAndUpdate(
            roomId,
            { $set: updates },
            { new: true, runValidators: true }
        );

        if (!room) {
            throw new AppError('Habitación no encontrada', 404);
        }

        return room;
    } catch (error) {
        if (error.code === 11000) {
            throw new AppError('Ya existe una habitación con ese número', 409);
        }

        throw error;
    }
};

module.exports = {
    getAllRooms,
    createRoom,
    updateRoom
};