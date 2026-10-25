const express = require('express');

const {protect, restrictTo} = require('../middlewares/authMiddleware');

const router = express.Router();

router.use(protect, restrictTo('admin'));

router.get('/dashboard', (req, res) => {
    res.status(200).json({
        status: 'success',
        message: 'Bienvenido al panel de administración',
        user: req.user
    });
});

module.exports = router;
