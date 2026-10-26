const mongoose = require('mongoose');

const guestSchema = new mongoose.Schema(
    {
        fullName: {
            type: String,
            required: [true, 'El nombre completo del huésped es obligatorio'],
            trim: true,
            minlength: 2,
            maxlength: 100
        },
        email: {
            type: String,
            required: [true, 'El correo del huésped es obligatorio'],
            trim: true,
            lowercase: true,
            maxlength: 254
        },
        phone: {
            type: String,
            required: [true, 'El teléfono del huésped es obligatorio'],
            trim: true,
            maxlength: 25
        },
        identification: {
            type: String,
            required: [true, 'La identificación del huésped es obligatoria'],
            trim: true,
            maxlength: 30
        }
    },
    { _id: false }
);

const reservationSchema = new mongoose.Schema(
    {
        guest: {
            type: guestSchema,
            required: true
        },
        room: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Room',
            required: [true, 'La habitación es obligatoria']
        },
        roomNumber: {
            type: String,
            required: true
        },
        roomType: {
            type: String,
            required: true
        },
        checkIn: {
            type: Date,
            required: [true, 'La fecha de check-in es obligatoria']
        },
        checkOut: {
            type: Date,
            required: [true, 'La fecha de check-out es obligatoria']
        },
        nights: {
            type: Number,
            required: true,
            min: 1
        },
        nightlyRate: {
            type: Number,
            required: [true, 'La tarifa aplicada es obligatoria'],
            min: [0, 'La tarifa aplicada no puede ser negativa']
        },
        totalAmount: {
            type: Number,
            required: true,
            min: 0
        },
        status: {
            type: String,
            enum: ['reservada', 'ocupada', 'cancelada', 'finalizada'],
            default: 'reservada',
            required: true
        },
        checkInAt: {
            type: Date
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        }
    },
    {
        timestamps: true,
        versionKey: false
    }
);

reservationSchema.index({ room: 1, status: 1, checkIn: 1, checkOut: 1 });

module.exports = mongoose.model('Reservation', reservationSchema);
