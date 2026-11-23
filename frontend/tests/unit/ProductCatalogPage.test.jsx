import React from 'react';
import { render, screen } from '@testing-library/react';
import ProductCatalogPage from '../../src/pages/ProductCatalogPage.jsx';

jest.mock('../../src/services/api.js', () => ({
  getProductCategories: jest.fn(),
  getProducts: jest.fn(),
  createProduct: jest.fn(),
  updateProduct: jest.fn(),
}));

import { getProductCategories, getProducts } from '../../src/services/api.js';

describe('ProductCatalogPage', () => {
  beforeEach(() => {
    getProductCategories.mockResolvedValue({ data: { categories: ['Minibar'] } });
  });

  test('presenta productos disponibles', async () => {
    getProducts.mockResolvedValue({
      data: { products: [{ _id: 'p1', name: 'Agua sin gas', category: 'Minibar', price: 5000, stock: 8, isActive: true }] },
    });

    render(<ProductCatalogPage token="test-token" />);

    expect(await screen.findByText('Agua sin gas')).toBeInTheDocument();
  });

  test('presenta el estado vacío', async () => {
    getProducts.mockResolvedValue({ data: { products: [] } });

    render(<ProductCatalogPage token="test-token" />);

    expect(await screen.findByText('Aún no hay productos')).toBeInTheDocument();
  });

  test('presenta el error del catálogo', async () => {
    getProducts.mockRejectedValue(new Error('No fue posible cargar el catálogo'));

    render(<ProductCatalogPage token="test-token" />);

    expect((await screen.findAllByText('No fue posible cargar el catálogo')).length).toBeGreaterThan(0);
  });
});
