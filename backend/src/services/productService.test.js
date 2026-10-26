jest.mock('../models/product', () => ({
    findOne: jest.fn(),
    find: jest.fn(),
    distinct: jest.fn(),
    create: jest.fn(),
    findByIdAndUpdate: jest.fn()
}));

const Product = require('../models/product');
const productService = require('./productService');

describe('productService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('lists products sorted by name', async () => {
        const products = [{ name: 'Agua' }, { name: 'Café' }];
        Product.find.mockReturnValue({ sort: jest.fn().mockResolvedValue(products) });

        await expect(productService.getProducts()).resolves.toEqual(products);
        expect(Product.find).toHaveBeenCalledWith({});
    });

    it('searches products by partial name, ignoring case and special characters', async () => {
        Product.find.mockReturnValue({ sort: jest.fn().mockResolvedValue([]) });

        await productService.getProducts({ search: ' agua (500ml) ' });

        const { name } = Product.find.mock.calls[0][0];
        const matcher = new RegExp(name.$regex, name.$options);
        expect(matcher.test('Agua (500ml) sin gas')).toBe(true);
        expect(matcher.test('Agua 500ml')).toBe(false);
    });

    it('combines category, status and stock filters', async () => {
        Product.find.mockReturnValue({ sort: jest.fn().mockResolvedValue([]) });

        await productService.getProducts({ category: ' bebidas ', status: 'activo', inStock: 'true' });

        expect(Product.find).toHaveBeenCalledWith({
            category: { $regex: '^bebidas$', $options: 'i' },
            isActive: true,
            stock: { $gt: 0 }
        });
    });

    it('filters inactive products and ignores empty filters', async () => {
        Product.find.mockReturnValue({ sort: jest.fn().mockResolvedValue([]) });

        await productService.getProducts({ search: '  ', category: '', status: 'inactivo', inStock: 'false' });

        expect(Product.find).toHaveBeenCalledWith({ isActive: false });
    });

    it('lists categories alphabetically, optionally only from active products', async () => {
        Product.distinct.mockResolvedValue(['Snacks', 'Bebidas', 'Aseo']);

        await expect(productService.getCategories()).resolves.toEqual(['Aseo', 'Bebidas', 'Snacks']);
        expect(Product.distinct).toHaveBeenCalledWith('category', {});

        await productService.getCategories({ activeOnly: true });
        expect(Product.distinct).toHaveBeenLastCalledWith('category', { isActive: true });
    });

    it('merges categories that differ only in letter case', async () => {
        Product.distinct.mockResolvedValue(['Bebidas', 'bebidas', 'Snacks', 'BEBIDAS']);

        await expect(productService.getCategories()).resolves.toEqual(['Bebidas', 'Snacks']);
    });

    it('updates a product with normalized changes', async () => {
        const product = { _id: 'product-id', name: 'Agua premium', price: 20 };
        Product.findOne.mockResolvedValue(null);
        Product.findByIdAndUpdate.mockResolvedValue(product);

        await expect(productService.updateProduct('product-id', {
            name: ' Agua premium ',
            description: '  Agua embotellada  ',
            category: ' Bebidas ',
            price: 20
        })).resolves.toBe(product);

        expect(Product.findOne).toHaveBeenCalledWith({
            name: { $regex: '^Agua premium$', $options: 'i' },
            _id: { $ne: 'product-id' }
        });
        expect(Product.findByIdAndUpdate).toHaveBeenCalledWith(
            'product-id',
            {
                $set: {
                    name: 'Agua premium',
                    description: 'Agua embotellada',
                    category: 'Bebidas',
                    price: 20
                }
            },
            { new: true, runValidators: true }
        );
    });

    it('rejects a duplicate product name', async () => {
        Product.findOne.mockResolvedValue({ _id: 'other-product' });

        await expect(productService.updateProduct('product-id', { name: 'Agua' }))
            .rejects.toMatchObject({ message: 'Ya existe un producto con ese nombre', statusCode: 409 });

        expect(Product.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    it('returns 404 when the product does not exist', async () => {
        Product.findByIdAndUpdate.mockResolvedValue(null);

        await expect(productService.updateProduct('product-id', { price: 20 }))
            .rejects.toMatchObject({ message: 'Producto no encontrado', statusCode: 404 });
    });

    it('rejects empty and unknown updates', async () => {
        await expect(productService.updateProduct('product-id', {}))
            .rejects.toMatchObject({ statusCode: 400 });
        await expect(productService.updateProduct('product-id', { status: false }))
            .rejects.toMatchObject({ statusCode: 400 });
    });

    it('deactivates a product without deleting it', async () => {
        const product = { _id: 'product-id', isActive: false };
        Product.findByIdAndUpdate.mockResolvedValue(product);

        await expect(productService.updateProduct('product-id', { isActive: false }))
            .resolves.toBe(product);
        expect(Product.findByIdAndUpdate).toHaveBeenCalledWith(
            'product-id',
            { $set: { isActive: false } },
            { new: true, runValidators: true }
        );
    });
});
