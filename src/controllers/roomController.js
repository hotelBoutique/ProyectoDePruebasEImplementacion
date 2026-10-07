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

module.exports = {
    getRooms
};
