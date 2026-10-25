const productService = require('../services/productService');
const catchAsync = require('../utils/catchAsync');

const createProduct = catchAsync(async (req, res) => {
    const product = await productService.createProduct(req.body);

    res.status(201).json({
        status: 'success',
        data: { product }
    });
});

module.exports = {
    createProduct
};
