jest.mock('../utils/logger', () => ({ error: jest.fn() }));

const logger = require('../utils/logger');
const AppError = require('../utils/AppError');
const errorHandler = require('../middlewares/errorHandler');
const catchAsync = require('../utils/catchAsync');

const createResponse = () => ({
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis()
});

describe('errorHandler', () => {
    beforeEach(() => jest.clearAllMocks());

    it('serializa AppError con su código y mensaje', () => {
        const res = createResponse();

        errorHandler(new AppError('No permitido', 403), {}, res, jest.fn());

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith({ success: false, message: 'No permitido' });
    });

    it('normaliza errores de JWT inválido y expirado', () => {
        const invalidResponse = createResponse();
        const expiredResponse = createResponse();

        errorHandler(Object.assign(new Error('bad token'), { name: 'JsonWebTokenError' }), {}, invalidResponse, jest.fn());
        errorHandler(Object.assign(new Error('expired'), { name: 'TokenExpiredError' }), {}, expiredResponse, jest.fn());

        expect(invalidResponse.status).toHaveBeenCalledWith(401);
        expect(invalidResponse.json).toHaveBeenCalledWith({ success: false, message: 'Token inválido' });
        expect(expiredResponse.status).toHaveBeenCalledWith(401);
        expect(expiredResponse.json).toHaveBeenCalledWith({ success: false, message: 'Token expirado' });
    });

    it('traduce claves duplicadas y errores de validación de MongoDB', () => {
        const duplicateResponse = createResponse();
        const validationResponse = createResponse();
        const validationError = Object.assign(new Error('invalid fields'), {
            name: 'ValidationError',
            errors: { name: { message: 'El nombre es obligatorio' } }
        });

        errorHandler(Object.assign(new Error('duplicate'), { code: 11000 }), {}, duplicateResponse, jest.fn());
        errorHandler(validationError, {}, validationResponse, jest.fn());

        expect(duplicateResponse.status).toHaveBeenCalledWith(409);
        expect(duplicateResponse.json).toHaveBeenCalledWith({ success: false, message: 'El recurso ya existe' });
        expect(validationResponse.status).toHaveBeenCalledWith(400);
        expect(validationResponse.json).toHaveBeenCalledWith({
            success: false,
            message: 'Datos inválidos',
            details: ['El nombre es obligatorio']
        });
    });

    it('oculta detalles internos para errores inesperados y normaliza 404', () => {
        const internalResponse = createResponse();
        const notFoundResponse = createResponse();

        errorHandler(new Error('sensitive database detail'), {}, internalResponse, jest.fn());
        errorHandler(Object.assign(new Error('framework detail'), { statusCode: 404 }), {}, notFoundResponse, jest.fn());

        expect(internalResponse.status).toHaveBeenCalledWith(500);
        expect(internalResponse.json).toHaveBeenCalledWith({
            success: false,
            message: 'Error interno del servidor'
        });
        expect(notFoundResponse.status).toHaveBeenCalledWith(404);
        expect(notFoundResponse.json).toHaveBeenCalledWith({ success: false, message: 'Recurso no encontrado' });
        expect(logger.error).toHaveBeenCalledTimes(2);
    });
});

describe('catchAsync', () => {
    it('envía los rechazos de una función asíncrona al siguiente middleware', async () => {
        const error = new Error('falló el servicio');
        const next = jest.fn();
        const handler = catchAsync(() => Promise.reject(error));

        await handler({}, {}, next);

        expect(next).toHaveBeenCalledWith(error);
    });
});
