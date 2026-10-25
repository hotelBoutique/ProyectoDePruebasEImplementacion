const config = require('./config/env');

const app = require('./app');
const connectDB =  require('./config/database');
const logger = require('./utils/logger');

let server;

const startServer = async () => {
    await connectDB();
    server = app.listen( config.PORT, () => {
            logger.info(`Servidor ejecutándose en puerto ${config.PORT}`);
            logger.info(`Entorno: ${config.NODE_ENV}`
            );
        }
    );
};

const shutdown = (signal) => {
    logger.info( `${signal} recibido. Cerrando servidor...`);

    if (!server) { process.exit(0); }
    server.close(() => {

        logger.info( 'Servidor HTTP cerrado correctamente' );
        process.exit(0);
    });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',() => shutdown('SIGINT'));


process.on('unhandledRejection',
    (error) => {
        logger.error('Unhandled Rejection', error);
        shutdown('unhandledRejection');
    }
);

process.on('uncaughtException',
    (error) => {
        logger.error('Uncaught Exception', error);
        process.exit(1);
    }
);

startServer();