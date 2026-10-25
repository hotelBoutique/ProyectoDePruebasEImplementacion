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
            trim: true,
            maxlength: 50
        },

        description: {
            type: String,
            trim: true,
            maxlength: 500,
            default: ''
        },

        capacity: {
            type: Number,
            min: [1, 'La capacidad debe ser de al menos una persona'],
            validate: {
                validator: value => value == null || Number.isInteger(value),
                message: 'La capacidad debe ser un número entero'
            }
        },

        price: {
            type: Number,
            required: [true, 'El precio es obligatorio'],
            min: 0
        },

        status: {
            type: String,
            enum: ['disponible', 'ocupada', 'mantenimiento', 'fuera de servicio'],
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
