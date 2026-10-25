const userService = require('../services/userService');
const catchAsync = require('../utils/catchAsync');

const createReceptionist = catchAsync(async (req, res) => {
    const user = await userService.createReceptionist(req.body);

    res.status(201).json({
        status: 'success',
        data: { user }
    });
});

const createAdmin = catchAsync(async (req, res) => {
    const user = await userService.createAdmin(req.body);

    res.status(201).json({
        status: 'success',
        data: { user }
    });
});

const getReceptionists = catchAsync(async (req, res) => {
    const users = await userService.getReceptionists();

    res.status(200).json({
        status: 'success',
        results: users.length,
        data: { users }
    });
});

const setReceptionistStatus = catchAsync(async (req, res) => {
    const user = await userService.setReceptionistStatus(
        req.params.id,
        req.body.isActive
    );

    res.status(200).json({
        status: 'success',
        data: { user }
    });
});

const updateReceptionist = catchAsync(async (req, res) => {
    const user = await userService.updateReceptionist(
        req.params.id,
        req.body
    );

    res.status(200).json({
        status: 'success',
        data: { user }
    });
});

module.exports = {
    createReceptionist,
    createAdmin,
    getReceptionists,
    setReceptionistStatus,
    updateReceptionist
};
