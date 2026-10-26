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

const getPendingCheckOuts = catchAsync(async (req, res) => {
    const reservations = await reservationService.getPendingCheckOuts();

    res.status(200).json({
        status: 'success',
        results: reservations.length,
        data: { reservations }
    });
});

const checkOutReservation = catchAsync(async (req, res) => {
    const reservation = await reservationService.checkOutReservation({
        reservationId: req.params.id,
        ...req.body
    });

    res.status(200).json({
        status: 'success',
        message: 'El pago se registró, la estancia finalizó y la habitación quedó disponible',
        data: {
            reservation,
            receipt: {
                reservationId: reservation._id,
                guest: reservation.guest,
                roomNumber: reservation.roomNumber,
                roomType: reservation.roomType,
                checkInAt: reservation.checkInAt,
                checkOutAt: reservation.checkOutAt,
                settlement: reservation.settlement
            }
        }
    });
});

const addReservationConsumption = catchAsync(async (req, res) => {
    const reservation = await reservationService.addReservationConsumption(
        req.params.id,
        req.body
    );

    res.status(201).json({
        status: 'success',
        message: 'El consumo se registró en la cuenta de la estancia',
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
    getPendingCheckOuts,
    checkOutReservation,
    addReservationConsumption,
    getAvailableRooms,
    createReservation
};
