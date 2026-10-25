const Product = require('../models/product');
const AppError = require('../utils/AppError');

const escapeRegExp = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const createProduct = async ({ name, description, category, price, stock, isActive }) => {
    const normalizedName = name.trim();
    const existingProduct = await Product.findOne({
        name: { $regex: `^${escapeRegExp(normalizedName)}$`, $options: 'i' }
    });

    if (existingProduct) {
        throw new AppError('Ya existe un producto con ese nombre', 409);
    }

    return Product.create({
        name,
        description,
        category,
        price,
        stock,
        isActive
    });
};

module.exports = {
    createProduct
};
