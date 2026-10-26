const mongoose = require('mongoose');

// Secuencias atómicas, por ejemplo el consecutivo de los comprobantes de pago.
const counterSchema = new mongoose.Schema(
    {
        _id: {
            type: String,
            required: true
        },
        seq: {
            type: Number,
            required: true,
            default: 0
        }
    },
    {
        versionKey: false
    }
);

module.exports = mongoose.model('Counter', counterSchema);
