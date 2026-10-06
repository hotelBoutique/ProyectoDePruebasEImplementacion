const express = require('express');

const {protect, restrictTo} = require('../middlewares/authMiddleware');

const router = express.Router();

router.get('/dashboard',
    protect,
    restrictTo('admin'),
    (req, res) => {
        res.status(200).json({
            status: 'success',
            message: 'Bienvenido al panel de administración',
            user: req.user
        });
    }
);

module.exports = router;