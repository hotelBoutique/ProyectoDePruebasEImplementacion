const productService = require('../services/productService');
const catchAsync = require('../utils/catchAsync');

const createProduct = catchAsync(async (req, res) => {
    const product = await productService.createProduct(req.body);

    res.status(201).json({
        status: 'success',
        message: 'Producto registrado correctamente',
        data: { product }
    });
});

const getProducts = catchAsync(async (req, res) => {
    const products = await productService.getProducts();

    res.status(200).json({
        status: 'success',
        results: products.length,
        data: { products }
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
    updateProduct
};
