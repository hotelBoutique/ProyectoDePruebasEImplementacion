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

module.exports = {
    createReceptionist,
    getReceptionists,
    setReceptionistStatus
};
