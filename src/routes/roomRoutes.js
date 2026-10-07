const express = require('express');

const roomController = require('../controllers/roomController');

const router = express.Router();

router.get('/',
    roomController.getRooms
);

module.exports = router;