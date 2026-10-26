jest.mock('../middlewares/authMiddleware', () => ({
    protect: (req, res, next) => {
        req.user = { role: req.get('x-role') || 'ADMIN' };
        next();
    },
    restrictTo: (...roles) => (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'No tienes permisos para esta acción'
            });
        }
        next();
    }
}));

jest.mock('../services/productService', () => ({
    createProduct: jest.fn(),
    getProducts: jest.fn(),
    getCategories: jest.fn(),
    updateProduct: jest.fn()
}));

const express = require('express');
const request = require('supertest');
const productService = require('../services/productService');
const productRoutes = require('./productRoutes');
const errorHandler = require('../middlewares/errorHandler');
const AppError = require('../utils/AppError');

const app = express();
app.use(express.json());
app.use('/api/v1/products', productRoutes);
app.use(errorHandler);

describe('productRoutes', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('allows an administrator to list products', async () => {
        productService.getProducts.mockResolvedValue([{ name: 'Agua' }]);

        const response = await request(app)
            .get('/api/v1/products');

        expect(response.status).toBe(200);
        expect(response.body.results).toBe(1);
        expect(productService.getProducts).toHaveBeenCalled();
    });

    it('passes catalog filters to the service for administrators', async () => {
        productService.getProducts.mockResolvedValue([]);

        const response = await request(app)
            .get('/api/v1/products')
            .query({ search: 'agua', category: 'Bebidas', status: 'inactivo', inStock: 'true' });

        expect(response.status).toBe(200);
        expect(productService.getProducts).toHaveBeenCalledWith({
            search: 'agua',
            category: 'Bebidas',
            status: 'inactivo',
            inStock: 'true'
        });
    });

    it('shows receptionists only active products', async () => {
        productService.getProducts.mockResolvedValue([]);

        const response = await request(app)
            .get('/api/v1/products')
            .set('x-role', 'RECEPCIONISTA')
            .query({ status: 'inactivo' });

        expect(response.status).toBe(200);
        expect(productService.getProducts).toHaveBeenCalledWith(expect.objectContaining({
            status: 'activo'
        }));
    });

    it('rejects invalid catalog filters', async () => {
        const response = await request(app)
            .get('/api/v1/products')
            .query({ status: 'agotado', inStock: 'si', search: 'a'.repeat(101) });

        expect(response.status).toBe(400);
        expect(response.body.errors.map(({ msg }) => msg)).toEqual(expect.arrayContaining([
            'El estado debe ser activo o inactivo',
            'El filtro de stock debe ser true o false',
            'La búsqueda no puede superar 100 caracteres'
        ]));
        expect(productService.getProducts).not.toHaveBeenCalled();
    });

    it('rejects a catalog filter sent more than once', async () => {
        const response = await request(app)
            .get('/api/v1/products?category=Bebidas&category=Snacks');

        expect(response.status).toBe(400);
        expect(response.body.errors.map(({ msg }) => msg)).toContain('Cada filtro admite un solo valor');
        expect(productService.getProducts).not.toHaveBeenCalled();
    });

    it('lists categories, limited to active products for receptionists', async () => {
        productService.getCategories.mockResolvedValue(['Bebidas', 'Snacks']);

        const adminResponse = await request(app).get('/api/v1/products/categories');
        const receptionResponse = await request(app)
            .get('/api/v1/products/categories')
            .set('x-role', 'RECEPCIONISTA');

        expect(adminResponse.status).toBe(200);
        expect(adminResponse.body.data.categories).toEqual(['Bebidas', 'Snacks']);
        expect(receptionResponse.status).toBe(200);
        expect(productService.getCategories).toHaveBeenNthCalledWith(1, { activeOnly: false });
        expect(productService.getCategories).toHaveBeenNthCalledWith(2, { activeOnly: true });
    });

    it('allows partial product updates', async () => {
        const product = { _id: '507f1f77bcf86cd799439011', name: 'Agua premium', price: 20 };
        productService.updateProduct.mockResolvedValue(product);

        const response = await request(app)
            .patch('/api/v1/products/507f1f77bcf86cd799439011')
            .send({ name: 'Agua premium', price: 20 });

        expect(response.status).toBe(200);
        expect(response.body.message).toBe('El producto se actualizó correctamente');
        expect(productService.updateProduct).toHaveBeenCalledWith(
            '507f1f77bcf86cd799439011',
            { name: 'Agua premium', price: 20 }
        );
    });

    it('returns 400 for invalid IDs, empty bodies and unknown fields', async () => {
        const invalidId = await request(app)
            .patch('/api/v1/products/invalid')
            .send({ price: 20 });
        expect(invalidId.status).toBe(400);

        const empty = await request(app)
            .patch('/api/v1/products/507f1f77bcf86cd799439011')
            .send({});
        expect(empty.status).toBe(400);

        const unknown = await request(app)
            .patch('/api/v1/products/507f1f77bcf86cd799439011')
            .send({ status: false });
        expect(unknown.status).toBe(400);
        expect(productService.updateProduct).not.toHaveBeenCalled();
    });

    it('returns duplicate conflicts through the controller chain', async () => {
        productService.updateProduct.mockRejectedValue(
            new AppError('Ya existe un producto con ese nombre', 409)
        );

        const response = await request(app)
            .patch('/api/v1/products/507f1f77bcf86cd799439011')
            .send({ name: 'Agua' });

        expect(response.status).toBe(409);
    });

    it('deactivates without deleting and denies receptionists', async () => {
        productService.updateProduct.mockResolvedValue({
            _id: '507f1f77bcf86cd799439011',
            isActive: false
        });

        const response = await request(app)
            .patch('/api/v1/products/507f1f77bcf86cd799439011')
            .send({ isActive: false });

        expect(response.status).toBe(200);
        expect(response.body.message).toBe('El producto se desactivó correctamente');

        productService.updateProduct.mockClear();
        const forbidden = await request(app)
            .patch('/api/v1/products/507f1f77bcf86cd799439011')
            .set('x-role', 'RECEPCIONISTA')
            .send({ price: 20 });
        expect(forbidden.status).toBe(403);
        expect(productService.updateProduct).not.toHaveBeenCalled();
    });
});
