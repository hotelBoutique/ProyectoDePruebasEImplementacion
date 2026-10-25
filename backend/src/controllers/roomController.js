const roomService = require('../services/roomService');
const catchAsync = require('../utils/catchAsync');

const getRooms = catchAsync(
    async (req, res) => {

        const rooms = await roomService.getAllRooms();

        if (rooms.length === 0) {
            return res.status(200).json({
                status: 'success',
                message: 'No existen habitaciones registradas',
                results: 0,
                data: {
                    rooms
                }
            });
        }

        res.status(200).json({
            status: 'success',
            results: rooms.length,
            data: {
                rooms
            }
        });
    }
);

const createRoom = catchAsync(async (req, res) => {
    const room = await roomService.createRoom(req.body);

    res.status(201).json({
        status: 'success',
        message: 'Habitación registrada correctamente',
        data: { room }
    });
});

module.exports = {
    getRooms,
    createRoom
};
