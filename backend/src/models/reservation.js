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

const additionalChargeSchema = new mongoose.Schema(
    {
        description: {
            type: String,
            required: true,
            trim: true,
            minlength: 2,
            maxlength: 120
        },
        amount: {
            type: Number,
            required: true,
            min: 0
        },
        quantity: {
            type: Number,
            required: true,
            min: 1
        },
        unitPrice: {
            type: Number,
            required: true,
            min: 0
        },
        subtotal: {
            type: Number,
            required: true,
            min: 0
        }
    },
    { _id: false }
);

const consumptionSchema = new mongoose.Schema(
    {
        description: {
            type: String,
            required: true,
            trim: true,
            minlength: 2,
            maxlength: 120
        },
        amount: {
            type: Number,
            min: 0
        },
        quantity: {
            type: Number,
            required: true,
            min: 1
        },
        unitPrice: {
            type: Number,
            required: true,
            min: 0
        },
        subtotal: {
            type: Number,
            required: true,
            min: 0
        },
        status: {
            type: String,
            enum: ['registrado', 'anulado'],
            default: 'registrado',
            required: true
        },
        correctionReason: {
            type: String,
            trim: true,
            maxlength: 500
        },
        voidedAt: Date,
        voidedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        voidReason: {
            type: String,
            trim: true,
            maxlength: 500
        }
    },
    { timestamps: true }
);

consumptionSchema.pre('validate', function normalizeConsumptionAmount() {
    if (this.amount == null && this.subtotal != null) {
        this.amount = this.subtotal;
    }
});

const settlementSchema = new mongoose.Schema(
    {
        status: {
            type: String,
            enum: ['pagada'],
            required: true
        },
        actualNights: {
            type: Number,
            required: true,
            min: 1
        },
        nightlyRate: {
            type: Number,
            required: true,
            min: 0
        },
        roomSubtotal: {
            type: Number,
            required: true,
            min: 0
        },
        additionalCharges: {
            type: [additionalChargeSchema],
            default: []
        },
        consumptions: {
            type: [additionalChargeSchema],
            default: []
        },
        consumptionsTotal: {
            type: Number,
            required: true,
            min: 0,
            default: 0
        },
        additionalChargesTotal: {
            type: Number,
            required: true,
            min: 0
        },
        totalAmount: {
            type: Number,
            required: true,
            min: 0
        },
        paidAmount: {
            type: Number,
            required: true,
            min: 0
        },
        paymentMethod: {
            type: String,
            enum: ['efectivo', 'tarjeta', 'transferencia'],
            required: true
        },
        paidAt: {
            type: Date,
            required: true
        }
    },
    { _id: false }
);

const cancellationSchema = new mongoose.Schema(
    {
        reason: {
            type: String,
            required: true,
            trim: true,
            minlength: 3,
            maxlength: 500
        },
        canceledAt: {
            type: Date,
            required: true
        },
        canceledBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
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
        consumptions: {
            type: [consumptionSchema],
            default: []
        },
        checkOutAt: {
            type: Date
        },
        settlement: {
            type: settlementSchema
        },
        cancellation: {
            type: cancellationSchema
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
