const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const config = require('./config/env');
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const errorHandler =require('./middlewares/errorHandler');
const app = express();

app.disable('x-powered-by');
app.use(helmet());
app.use(
    cors({
        origin: config.CORS_ORIGIN
    })
);

app.use(
    express.json({
        limit: '10kb'
    })
);

app.use(compression());

const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false
});

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false
});

app.use('/api', apiLimiter);

if (config.NODE_ENV !== 'test') {
    app.use(morgan('dev'));
}

app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'success',
        message: 'API funcionando correctamente'
    });
});

app.use( '/api/v1/auth',  authRoutes);

app.use( '/api/v1/admin', loginLimiter, adminRoutes);

app.use((req, res) => {
    res.status(404).json({
        status: 'fail',
        message: `Ruta ${req.originalUrl} no encontrada`
    });
});

app.use(errorHandler);

module.exports = app;