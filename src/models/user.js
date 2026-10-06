const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'El nombre es obligatorio'],
            trim: true,
            minlength: 2,
            maxlength: 100
        },

        email: {
            type: String,
            required: [true, 'El correo es obligatorio'],
            unique: true,
            lowercase: true,
            trim: true
        },

        password: {
            type: String,
            required: [true, 'La contraseña es obligatoria'],
            minlength: 8,
            select: false
        },

        role: {
            type: String,
            enum: ['user', 'admin'],
            default: 'user'
        }
    },
    {
        timestamps: true,
        versionKey: false
    }
);

userSchema.pre(
    'save',
    async function() {

        if (!this.isModified('password')) {
            return;
        }

        this.password = await bcrypt.hash(
            this.password,
            12
        );
    }
);

userSchema.methods.correctPassword =
    async function(candidatePassword, userPassword) {

        return await bcrypt.compare(
            candidatePassword,
            userPassword
        );
    };

userSchema.methods.toJSON = function() {

    const user = this.toObject();

    delete user.password;

    return user;
};

module.exports = mongoose.model(
    'User',
    userSchema
);