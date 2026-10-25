const jwt = require('jsonwebtoken');

const User = require('../models/user');
const AppError = require('../utils/AppError');
const config = require('../config/env');

const generateToken = (user) => {

    return jwt.sign(
        {
            sub: user._id.toString(),
            ver: user.tokenVersion ?? 0
        },

        config.JWT_SECRET,
        
        {
            expiresIn: config.JWT_EXPIRES_IN
        }
    );
};

const login = async (email, password) => {

    const user = await User
        .findOne({ email })
        .select('+password +tokenVersion');

    if (!user || !(await user.correctPassword(
            password,
            user.password
        ))
    ) {
        throw new AppError('Correo o contraseña incorrectos',401);
    }

    if (user.isActive === false) {
        throw new AppError('La cuenta está desactivada', 403);
    }

    const token = generateToken(user);

    return {
        user,
        token
    };
};


const logout = async (userId) => {
    const user = await User.findByIdAndUpdate(
        userId,
        { $inc: { tokenVersion: 1 } },
        { new: true }
    );

    if (!user) {
        throw new AppError('El usuario ya no existe', 401);
    }
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

const updateMyProfile = async (userId, { name, currentPassword, newPassword }) => {
    const user = await User.findById(userId).select('+password +tokenVersion');

    if (!user) {
        throw new AppError('Usuario no encontrado', 404);
    }

    if (newPassword) {
        const passwordIsCorrect = await user.correctPassword(
            currentPassword,
            user.password
        );

        if (!passwordIsCorrect) {
            throw new AppError('La contraseña actual es incorrecta', 400);
        }

        user.password = newPassword;
        user.tokenVersion = (user.tokenVersion ?? 0) + 1;
    }

    if (name !== undefined) {
        user.name = name;
    }

    await user.save();

    return {
        user,
        ...(newPassword ? { token: generateToken(user) } : {})
    };
};


module.exports = {
    login,
    logout,
    getMe,
    updateMyProfile
};
