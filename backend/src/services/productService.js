const Product = require('../models/product');
const AppError = require('../utils/AppError');

const escapeRegExp = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const PRODUCT_FIELDS = ['name', 'description', 'category', 'price', 'stock', 'isActive'];

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

const buildProductFilter = ({ search, category, status, inStock } = {}) => {
    const filter = {};

    if (search && search.trim()) {
        filter.name = { $regex: escapeRegExp(search.trim()), $options: 'i' };
    }

    if (category && category.trim()) {
        filter.category = { $regex: `^${escapeRegExp(category.trim())}$`, $options: 'i' };
    }

    if (status === 'activo') filter.isActive = true;
    if (status === 'inactivo') filter.isActive = false;

    if (inStock === 'true') {
        filter.stock = { $gt: 0 };
    }

    return filter;
};

const getProducts = async (filters) => {
    return Product.find(buildProductFilter(filters))
        .sort({ name: 1 });
};

const getCategories = async ({ activeOnly = false } = {}) => {
    const categories = await Product.distinct('category', activeOnly ? { isActive: true } : {});
    const byName = new Map();

    // La categoría es texto libre: "bebidas" y "Bebidas" son la misma opción de filtro.
    categories.forEach(category => {
        const key = category.toLocaleLowerCase('es');
        if (!byName.has(key)) byName.set(key, category);
    });

    return [...byName.values()].sort((a, b) => a.localeCompare(b, 'es'));
};

const updateProduct = async (productId, changes) => {
    if (!changes || typeof changes !== 'object' || Array.isArray(changes)) {
        throw new AppError('Los datos del producto son inválidos', 400);
    }

    const fields = Object.keys(changes);
    if (!fields.length) {
        throw new AppError('Indica al menos un dato para actualizar', 400);
    }

    const unexpectedFields = fields.filter(field => !PRODUCT_FIELDS.includes(field));
    if (unexpectedFields.length) {
        throw new AppError('La solicitud contiene datos de producto no editables', 400);
    }

    const updates = {};

    if (changes.name !== undefined) {
        const normalizedName = changes.name.trim();
        const existingProduct = await Product.findOne({
            name: { $regex: `^${escapeRegExp(normalizedName)}$`, $options: 'i' },
            _id: { $ne: productId }
        });

        if (existingProduct) {
            throw new AppError('Ya existe un producto con ese nombre', 409);
        }
        updates.name = normalizedName;
    }

    if (changes.description !== undefined) {
        updates.description = changes.description === null ? '' : changes.description.trim();
    }

    if (changes.category !== undefined) {
        updates.category = changes.category.trim();
    }

    if (changes.price !== undefined) updates.price = changes.price;
    if (changes.stock !== undefined) updates.stock = changes.stock;
    if (changes.isActive !== undefined) updates.isActive = changes.isActive;

    try {
        const product = await Product.findByIdAndUpdate(
            productId,
            { $set: updates },
            { new: true, runValidators: true }
        );

        if (!product) {
            throw new AppError('Producto no encontrado', 404);
        }

        return product;
    } catch (error) {
        if (error.code === 11000) {
            throw new AppError('Ya existe un producto con ese nombre', 409);
        }
        throw error;
    }
};

module.exports = {
    createProduct,
    getProducts,
    getCategories,
    updateProduct
};
