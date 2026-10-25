const authService = require('../services/authService');
const userService = require('../services/userService');
const catchAsync = require('../utils/catchAsync');

const register = catchAsync(
    async (req, res) => {

        const user = await userService.createReceptionist(req.body);

        res.status(201).json({
            status: 'success',
            data: { user }
        });
    }
);

const login = catchAsync(
    async (req, res) => {

        const {email, password} = req.body;

        const result = await authService.login(
                email,
                password
            );

        res.status(200).json({
            status: 'success',
            data: result
        });
    }
);

const logout = catchAsync(
    async (req, res) => {
        await authService.logout(req.user._id);

        res.status(200).json({
            status: 'success',
            message: 'Sesión cerrada correctamente'
        });
    }
);

const me = catchAsync(
    async (req, res) => {

        const user = await authService.getMe(
                req.user._id
            );

        res.status(200).json({
            status: 'success',
            data: {
                user
            }
        });
    }
);

const updateMe = catchAsync(async (req, res) => {
    const result = await authService.updateMyProfile(
        req.user._id,
        req.body
    );

    res.status(200).json({
        status: 'success',
        data: result
    });
});

module.exports = {
    register,
    login,
    logout,
    me,
    updateMe
};
