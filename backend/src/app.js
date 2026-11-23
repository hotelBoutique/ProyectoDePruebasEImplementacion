const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const config = require('./config/env');
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const receptionRoutes = require('./routes/receptionRoutes');
const userRoutes = require('./routes/userRoutes');
const roomRoutes = require('./routes/roomRoutes');
const reservationRoutes = require('./routes/reservationRoutes');
const productRoutes = require('./routes/productRoutes');
const errorHandler = require('./middlewares/errorHandler');
const AppError = require('./utils/AppError');
const app = express();

app.disable('x-powered-by');

// En producción (Render) la API corre detrás de un proxy: sin esto el
// rate limiter vería la IP del proxy y contaría a todos los clientes juntos.
if (config.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
}
app.use(helmet());
app.use(
    cors({
        origin: config.CORS_ORIGIN
    })
);

app.use( express.json({ limit: '10kb'}));

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

app.use('/api/v1/auth/login', loginLimiter);
app.use('/api/v1/auth', authRoutes);

app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/reception', receptionRoutes);
app.use('/api/v1/users', userRoutes);

app.use('/api/v1/rooms', roomRoutes);
app.use('/api/v1/reservations', reservationRoutes);
app.use('/api/v1/products', productRoutes);

app.use((req, res, next) => {
    next(new AppError('Ruta no encontrada', 404));
});

app.use(errorHandler);

module.exports = app;
