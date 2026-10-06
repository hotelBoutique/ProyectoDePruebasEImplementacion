const authService = require('../services/authService');
const catchAsync = require('../utils/catchAsync');

const register = catchAsync(
    async (req, res) => {

        const result = await authService.register(req.body);

        res.status(201).json({
            status: 'success',
            data: result
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

module.exports = {
    register,
    login,
    me
};