const reservationService = require('../services/reservationService');
const catchAsync = require('../utils/catchAsync');

const getPendingCheckIns = catchAsync(async (req, res) => {
    const reservations = await reservationService.getPendingCheckIns();

    res.status(200).json({
        status: 'success',
        results: reservations.length,
        data: { reservations }
    });
});

const checkInReservation = catchAsync(async (req, res) => {
    const reservation = await reservationService.checkInReservation(req.params.id);

    res.status(200).json({
        status: 'success',
        message: 'El check-in se registró correctamente y la habitación ahora está ocupada',
        data: { reservation }
    });
});

const getAvailableRooms = catchAsync(async (req, res) => {
    const rooms = await reservationService.getAvailableRooms(
        req.query.checkIn,
        req.query.checkOut,
        req.query.roomId
    );

    res.status(200).json({
        status: 'success',
        results: rooms.length,
        data: { rooms }
    });
});

const createReservation = catchAsync(async (req, res) => {
    const reservation = await reservationService.createReservation({
        ...req.body,
        createdBy: req.user._id
    });

    res.status(201).json({
        status: 'success',
        message: 'La reservación se confirmó correctamente',
        data: {
            reservation,
            receipt: {
                reservationId: reservation._id,
                guest: reservation.guest,
                roomNumber: reservation.roomNumber,
                roomType: reservation.roomType,
                checkIn: reservation.checkIn,
                checkOut: reservation.checkOut,
                nights: reservation.nights,
                nightlyRate: reservation.nightlyRate,
                totalAmount: reservation.totalAmount
            }
        }
    });
});

module.exports = {
    getPendingCheckIns,
    checkInReservation,
    getAvailableRooms,
    createReservation
};
