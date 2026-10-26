const productService = require('../services/productService');
const catchAsync = require('../utils/catchAsync');
const { ROLES } = require('../constants/roles');

// Recepción solo trabaja con productos que se pueden vender.
const isReception = req => req.user.role === ROLES.RECEPCIONISTA;

const createProduct = catchAsync(async (req, res) => {
    const product = await productService.createProduct(req.body);

    res.status(201).json({
        status: 'success',
        message: 'Producto registrado correctamente',
        data: { product }
    });
});

const getProducts = catchAsync(async (req, res) => {
    const { search, category, status, inStock } = req.query;
    const products = await productService.getProducts({
        search,
        category,
        status: isReception(req) ? 'activo' : status,
        inStock
    });

    res.status(200).json({
        status: 'success',
        results: products.length,
        data: { products }
    });
});

const getCategories = catchAsync(async (req, res) => {
    const categories = await productService.getCategories({ activeOnly: isReception(req) });

    res.status(200).json({
        status: 'success',
        results: categories.length,
        data: { categories }
    });
});

const updateProduct = catchAsync(async (req, res) => {
    const product = await productService.updateProduct(req.params.id, req.body);
    const message = product.isActive === false
        ? 'El producto se desactivó correctamente'
        : 'El producto se actualizó correctamente';

    res.status(200).json({
        status: 'success',
        message,
        data: { product }
    });
});

module.exports = {
    createProduct,
    getProducts,
    getCategories,
    updateProduct
};
