const roomService = require('../services/roomService');
const catchAsync = require('../utils/catchAsync');

const getRooms = catchAsync(
    async (req, res) => {

        const { status, type, minCapacity, minPrice, maxPrice } = req.query;
        const filters = { status, type, minCapacity, minPrice, maxPrice };
        const hasFilters = Object.values(filters).some(value => value && String(value).trim());

        const rooms = await roomService.getAllRooms(filters);

        if (rooms.length === 0) {
            return res.status(200).json({
                status: 'success',
                message: hasFilters
                    ? 'No hay habitaciones que coincidan con los filtros'
                    : 'No existen habitaciones registradas',
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

const updateRoom = catchAsync(async (req, res) => {
    const room = await roomService.updateRoom(req.params.id, req.body);

    res.status(200).json({
        status: 'success',
        message: req.body.status === 'fuera de servicio'
            ? 'La habitación se desactivó correctamente'
            : 'La habitación se actualizó correctamente',
        data: { room }
    });
});

module.exports = {
    getRooms,
    createRoom,
    updateRoom
};
