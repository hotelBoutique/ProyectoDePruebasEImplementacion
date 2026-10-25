const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema(
    {
        number: {
            type: String,
            required: [true, 'El número de habitación es obligatorio'],
            unique: true,
            trim: true
        },

        type: {
            type: String,
            required: [true, 'El tipo de habitación es obligatorio'],
            trim: true
        },

        price: {
            type: Number,
            required: [true, 'El precio es obligatorio'],
            min: 0
        },

        status: {
            type: String,
            enum: ['disponible', 'ocupada', 'mantenimiento'],
            default: 'disponible'
        }
    },
    {
        timestamps: true,
        versionKey: false
    }
);

module.exports = mongoose.model(
    'Room',
    roomSchema
);
