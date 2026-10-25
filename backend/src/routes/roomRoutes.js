const express = require('express');

const roomController = require('../controllers/roomController');
const { protect, restrictTo } = require('../middlewares/authMiddleware');
const { ROLES } = require('../constants/roles');

const router = express.Router();

router.use(
    protect,
    restrictTo(ROLES.ADMIN, ROLES.RECEPCIONISTA)
);

router.get('/',
    roomController.getRooms
);

module.exports = router;
