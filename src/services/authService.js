const jwt = require('jsonwebtoken');

const User = require('../models/user');
const AppError = require('../utils/AppError');
const config = require('../config/env');

const generateToken = (userId) => {

    return jwt.sign(
        {
            sub: userId.toString()
        },

        config.JWT_SECRET,
        
        {
            expiresIn: config.JWT_EXPIRES_IN
        }
    );
};

const register = async ({ name, email, password }) => {

    const existingUser = await User.findOne({email});

    if (existingUser) {
        throw new AppError( 'El correo ya está registrado', 409);
    }

    const user = await User.create({
        name,
        email,
        password,
        role: 'user'
    });

    const token = generateToken(user._id);

    return {
        user,
        token
    };
};


const login = async (email, password) => {

    const user = await User
        .findOne({ email })
        .select('+password');

    if (!user || !(await user.correctPassword(
            password,
            user.password
        ))
    ) {
        throw new AppError('Correo o contraseña incorrectos',401);
    }

    const token = generateToken(user._id);

    return {
        user,
        token
    };
};


const getMe = async (userId) => {

    const user = await User.findById(userId);

    if (!user) {
        throw new AppError(
            'Usuario no encontrado',
            404
        );
    }

    return user;
};


module.exports = {
    register,
    login,
    getMe
};