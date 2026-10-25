const Room = require('../models/room');

const getAllRooms = async () => {

    return await Room
        .find()
        .sort({ number: 1 });
};

module.exports = {
    getAllRooms
};