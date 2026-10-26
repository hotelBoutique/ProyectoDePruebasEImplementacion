const reservationService = require('../services/reservationService');
const receiptService = require('../services/receiptService');
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

const getReservationConsumptions = catchAsync(async (req, res) => {
    const result = await reservationService.getReservationConsumptions(req.params.id);

    res.status(200).json({
        status: 'success',
        results: result.consumptions.length,
        data: result
    });
});

const updateReservationConsumption = catchAsync(async (req, res) => {
    const reservation = await reservationService.updateReservationConsumption(
        req.params.id,
        req.params.consumptionId,
        req.body
    );

    res.status(200).json({
        status: 'success',
        message: 'El consumo se corrigió correctamente',
        data: { reservation }
    });
});

const voidReservationConsumption = catchAsync(async (req, res) => {
    const reservation = await reservationService.voidReservationConsumption(
        req.params.id,
        req.params.consumptionId,
        req.body.reason,
        req.user._id
    );

    res.status(200).json({
        status: 'success',
        message: 'El consumo se anuló correctamente',
        data: { reservation }
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
        req.query.roomId,
        {
            type: req.query.type,
            guests: req.query.guests,
            maxPrice: req.query.maxPrice
        }
    );

    res.status(200).json({
        status: 'success',
        results: rooms.length,
        data: { rooms }
    });
});

const getReservations = catchAsync(async (req, res) => {
    const reservations = await reservationService.getReservations(req.query);

    res.status(200).json({
        status: 'success',
        results: reservations.length,
        data: { reservations }
    });
});

const getSettlementHistory = catchAsync(async (req, res) => {
    const settlements = await reservationService.getSettlementHistory();

    res.status(200).json({
        status: 'success',
        results: settlements.length,
        data: { settlements }
    });
});

const getPayments = catchAsync(async (req, res) => {
    const result = await reservationService.getPayments(req.query);

    res.status(200).json({
        status: 'success',
        results: result.payments.length,
        data: result
    });
});

const getReceipt = catchAsync(async (req, res) => {
    const receipt = await receiptService.getReceipt(req.params.id);

    res.status(200).json({
        status: 'success',
        message: `Comprobante ${receipt.receiptNumber} generado correctamente`,
        data: { receipt }
    });
});

const getPaymentById = catchAsync(async (req, res) => {
    const payment = await reservationService.getPaymentById(req.params.id);

    res.status(200).json({
        status: 'success',
        data: { payment }
    });
});

const getReservationById = catchAsync(async (req, res) => {
    const reservation = await reservationService.getReservationById(req.params.id);

    res.status(200).json({
        status: 'success',
        data: { reservation }
    });
});

const updateReservation = catchAsync(async (req, res) => {
    const reservation = await reservationService.updateReservation(
        req.params.id,
        req.body
    );

    res.status(200).json({
        status: 'success',
        message: 'La reservación se actualizó correctamente',
        data: { reservation }
    });
});

const cancelReservation = catchAsync(async (req, res) => {
    const reservation = await reservationService.cancelReservation(
        req.params.id,
        req.body.reason,
        req.user._id
    );

    res.status(200).json({
        status: 'success',
        message: 'La reservación se canceló y sus fechas quedaron disponibles',
        data: { reservation }
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
    getReservationConsumptions,
    updateReservationConsumption,
    voidReservationConsumption,
    getAvailableRooms,
    getReservations,
    getSettlementHistory,
    getPayments,
    getPaymentById,
    getReceipt,
    getReservationById,
    createReservation,
    updateReservation,
    cancelReservation
};
