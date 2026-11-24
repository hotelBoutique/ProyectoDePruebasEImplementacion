import React from 'react';
import { render, screen, within } from '@testing-library/react';
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
      data: { products: [{
        _id: 'p1',
        name: 'Agua sin gas',
        category: 'Minibar',
        description: 'Botella de 600 ml',
        price: 5000,
        stock: 8,
        isActive: true,
      }] },
    });

    render(<ProductCatalogPage token="test-token" />);

    const table = await screen.findByRole('table');
    const product = within(table).getByRole('row', { name: /Agua sin gas/ });

    expect(getProducts).toHaveBeenCalledWith('test-token', {
      search: '',
      category: '',
      status: '',
      inStock: '',
    });
    expect(within(product).getByText('Botella de 600 ml')).toBeInTheDocument();
    expect(within(product).getByText('Minibar')).toBeInTheDocument();
    expect(within(product).getByText(/5\.000/)).toBeInTheDocument();
    expect(within(product).getByText('8')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('1 producto en el catálogo.');
  });

  test('presenta el estado vacío', async () => {
    getProducts.mockResolvedValue({ data: { products: [] } });

    render(<ProductCatalogPage token="test-token" />);

    expect(await screen.findByText('Aún no hay productos')).toBeInTheDocument();
    expect(screen.getByText('Todavía no hay productos activos en el catálogo.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByText('Cargando catálogo…')).not.toBeInTheDocument();
  });

  test('presenta el error del catálogo', async () => {
    getProducts.mockRejectedValue(new Error('El servicio de productos no responde'));

    render(<ProductCatalogPage token="test-token" />);

    expect(await screen.findByText('No fue posible cargar el catálogo')).toBeInTheDocument();
    expect(screen.getByText('El servicio de productos no responde')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByText('Aún no hay productos')).not.toBeInTheDocument();
  });
});
