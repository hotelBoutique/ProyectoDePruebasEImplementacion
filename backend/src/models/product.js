const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'El nombre del producto es obligatorio'],
            trim: true,
            minlength: 2,
            maxlength: 100,
            unique: true
        },

        description: {
            type: String,
            trim: true,
            maxlength: 500,
            default: ''
        },

        category: {
            type: String,
            required: [true, 'La categoría es obligatoria'],
            trim: true,
            maxlength: 50
        },

        price: {
            type: Number,
            required: [true, 'El precio es obligatorio'],
            min: [0, 'El precio no puede ser negativo']
        },

        stock: {
            type: Number,
            required: [true, 'El stock es obligatorio'],
            min: [0, 'El stock no puede ser negativo'],
            validate: {
                validator: Number.isInteger,
                message: 'El stock debe ser un número entero'
            },
            default: 0
        },

        isActive: {
            type: Boolean,
            default: true,
            required: true
        }
    },
    {
        timestamps: true,
        versionKey: false
    }
);

module.exports = mongoose.model('Product', productSchema);
