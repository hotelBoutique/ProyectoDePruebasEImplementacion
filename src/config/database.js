const mongoose = require('mongoose');
const config = require('./env');
const logger = require('../utils/logger');

const connectDB = async () => {
    try {
        await mongoose.connect(config.MONGODB_URI);
        logger.info('MongoDB conectado correctamente');

    } catch (error) {
        logger.error('No fue posible conectar a MongoDB', error);
        process.exit(1);
    }
};

module.exports = connectDB;