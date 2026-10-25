const User = require('../models/user');
const AppError = require('../utils/AppError');
const { ROLES } = require('../constants/roles');

const createReceptionist = async ({ name, email, password }) => {
    const existingUser = await User.findOne({ email });

    if (existingUser) {
        throw new AppError('El correo ya está registrado', 409);
    }

    return User.create({
        name,
        email,
        password,
        role: ROLES.RECEPCIONISTA,
        isActive: true
    });
};

const getReceptionists = async () => {
    return User.find({ role: ROLES.RECEPCIONISTA })
        .select('name email role isActive createdAt updatedAt')
        .sort({ name: 1, email: 1 });
};

const setReceptionistStatus = async (userId, isActive) => {
    const user = await User.findOneAndUpdate(
        {
            _id: userId,
            role: ROLES.RECEPCIONISTA
        },
        {
            $set: { isActive },
            $inc: { tokenVersion: 1 }
        },
        {
            new: true,
            runValidators: true
        }
    ).select('name email role isActive createdAt updatedAt');

    if (!user) {
        throw new AppError('Recepcionista no encontrado', 404);
    }

    return user;
};

const updateReceptionist = async (userId, changes) => {
    const user = await User.findOne({
        _id: userId,
        role: ROLES.RECEPCIONISTA
    }).select('+tokenVersion');

    if (!user) {
        throw new AppError('Recepcionista no encontrado', 404);
    }

    let shouldRevokeSessions = false;

    if (changes.name !== undefined) {
        user.name = changes.name;
    }

    if (changes.password !== undefined) {
        user.password = changes.password;
        shouldRevokeSessions = true;
    }

    if (changes.isActive !== undefined && changes.isActive !== user.isActive) {
        user.isActive = changes.isActive;
        shouldRevokeSessions = true;
    }

    if (shouldRevokeSessions) {
        user.tokenVersion = (user.tokenVersion ?? 0) + 1;
    }

    await user.save();

    return user;
};

module.exports = {
    createReceptionist,
    getReceptionists,
    setReceptionistStatus,
    updateReceptionist
};
